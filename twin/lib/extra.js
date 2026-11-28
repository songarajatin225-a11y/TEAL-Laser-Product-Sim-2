( function () {

	const _tempNormal = new THREE.Vector3();
	function getUv( faceDirVector, normal, uvAxis, projectionAxis, radius, sideLength ) {

		const totArcLength = 2 * Math.PI * radius / 4;

		// length of the planes between the arcs on each axis
		const centerLength = Math.max( sideLength - 2 * radius, 0 );
		const halfArc = Math.PI / 4;

		// Get the vector projected onto the Y plane
		_tempNormal.copy( normal );
		_tempNormal[ projectionAxis ] = 0;
		_tempNormal.normalize();

		// total amount of UV space alloted to a single arc
		const arcUvRatio = 0.5 * totArcLength / ( totArcLength + centerLength );

		// the distance along one arc the point is at
		const arcAngleRatio = 1.0 - _tempNormal.angleTo( faceDirVector ) / halfArc;
		if ( Math.sign( _tempNormal[ uvAxis ] ) === 1 ) {

			return arcAngleRatio * arcUvRatio;

		} else {

			// total amount of UV space alloted to the plane between the arcs
			const lenUv = centerLength / ( totArcLength + centerLength );
			return lenUv + arcUvRatio + arcUvRatio * ( 1.0 - arcAngleRatio );

		}

	}

	class RoundedBoxGeometry extends THREE.BoxGeometry {

		constructor( width = 1, height = 1, depth = 1, segments = 2, radius = 0.1 ) {

			// ensure segments is odd so we have a plane connecting the rounded corners
			segments = segments * 2 + 1;

			// ensure radius isn't bigger than shortest side
			radius = Math.min( width / 2, height / 2, depth / 2, radius );
			super( 1, 1, 1, segments, segments, segments );

			// if we just have one segment we're the same as a regular box
			if ( segments === 1 ) return;
			const geometry2 = this.toNonIndexed();
			this.index = null;
			this.attributes.position = geometry2.attributes.position;
			this.attributes.normal = geometry2.attributes.normal;
			this.attributes.uv = geometry2.attributes.uv;

			//

			const position = new THREE.Vector3();
			const normal = new THREE.Vector3();
			const box = new THREE.Vector3( width, height, depth ).divideScalar( 2 ).subScalar( radius );
			const positions = this.attributes.position.array;
			const normals = this.attributes.normal.array;
			const uvs = this.attributes.uv.array;
			const faceTris = positions.length / 6;
			const faceDirVector = new THREE.Vector3();
			const halfSegmentSize = 0.5 / segments;
			for ( let i = 0, j = 0; i < positions.length; i += 3, j += 2 ) {

				position.fromArray( positions, i );
				normal.copy( position );
				normal.x -= Math.sign( normal.x ) * halfSegmentSize;
				normal.y -= Math.sign( normal.y ) * halfSegmentSize;
				normal.z -= Math.sign( normal.z ) * halfSegmentSize;
				normal.normalize();
				positions[ i + 0 ] = box.x * Math.sign( position.x ) + normal.x * radius;
				positions[ i + 1 ] = box.y * Math.sign( position.y ) + normal.y * radius;
				positions[ i + 2 ] = box.z * Math.sign( position.z ) + normal.z * radius;
				normals[ i + 0 ] = normal.x;
				normals[ i + 1 ] = normal.y;
				normals[ i + 2 ] = normal.z;
				const side = Math.floor( i / faceTris );
				switch ( side ) {

					case 0:
						// right

						// generate UVs along Z then Y
						faceDirVector.set( 1, 0, 0 );
						uvs[ j + 0 ] = getUv( faceDirVector, normal, 'z', 'y', radius, depth );
						uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'y', 'z', radius, height );
						break;
					case 1:
						// left

						// generate UVs along Z then Y
						faceDirVector.set( - 1, 0, 0 );
						uvs[ j + 0 ] = 1.0 - getUv( faceDirVector, normal, 'z', 'y', radius, depth );
						uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'y', 'z', radius, height );
						break;
					case 2:
						// top

						// generate UVs along X then Z
						faceDirVector.set( 0, 1, 0 );
						uvs[ j + 0 ] = 1.0 - getUv( faceDirVector, normal, 'x', 'z', radius, width );
						uvs[ j + 1 ] = getUv( faceDirVector, normal, 'z', 'x', radius, depth );
						break;
					case 3:
						// bottom

						// generate UVs along X then Z
						faceDirVector.set( 0, - 1, 0 );
						uvs[ j + 0 ] = 1.0 - getUv( faceDirVector, normal, 'x', 'z', radius, width );
						uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'z', 'x', radius, depth );
						break;
					case 4:
						// front

						// generate UVs along X then Y
						faceDirVector.set( 0, 0, 1 );
						uvs[ j + 0 ] = 1.0 - getUv( faceDirVector, normal, 'x', 'y', radius, width );
						uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'y', 'x', radius, height );
						break;
					case 5:
						// back

						// generate UVs along X then Y
						faceDirVector.set( 0, 0, - 1 );
						uvs[ j + 0 ] = getUv( faceDirVector, normal, 'x', 'y', radius, width );
						uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'y', 'x', radius, height );
						break;

				}

			}

		}

	}

	THREE.RoundedBoxGeometry = RoundedBoxGeometry;

} )();

;
( function () {

	/**
 * Full-screen textured quad shader
 */

	const CopyShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'opacity': {
				value: 1.0
			}
		},
		vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader: /* glsl */`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );
			gl_FragColor.a *= opacity;


		}`
	};

	THREE.CopyShader = CopyShader;

} )();

;
( function () {

	/**
 * TODO
 */

	const SAOShader = {
		defines: {
			'NUM_SAMPLES': 7,
			'NUM_RINGS': 4,
			'NORMAL_TEXTURE': 0,
			'DIFFUSE_TEXTURE': 0,
			'DEPTH_PACKING': 1,
			'PERSPECTIVE_CAMERA': 1
		},
		uniforms: {
			'tDepth': {
				value: null
			},
			'tDiffuse': {
				value: null
			},
			'tNormal': {
				value: null
			},
			'size': {
				value: new THREE.Vector2( 512, 512 )
			},
			'cameraNear': {
				value: 1
			},
			'cameraFar': {
				value: 100
			},
			'cameraProjectionMatrix': {
				value: new THREE.Matrix4()
			},
			'cameraInverseProjectionMatrix': {
				value: new THREE.Matrix4()
			},
			'scale': {
				value: 1.0
			},
			'intensity': {
				value: 0.1
			},
			'bias': {
				value: 0.5
			},
			'minResolution': {
				value: 0.0
			},
			'kernelRadius': {
				value: 100.0
			},
			'randomSeed': {
				value: 0.0
			}
		},
		vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
		fragmentShader: /* glsl */`

		#include <common>

		varying vec2 vUv;

		#if DIFFUSE_TEXTURE == 1
		uniform sampler2D tDiffuse;
		#endif

		uniform sampler2D tDepth;

		#if NORMAL_TEXTURE == 1
		uniform sampler2D tNormal;
		#endif

		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraInverseProjectionMatrix;

		uniform float scale;
		uniform float intensity;
		uniform float bias;
		uniform float kernelRadius;
		uniform float minResolution;
		uniform vec2 size;
		uniform float randomSeed;

		// RGBA depth

		#include <packing>

		vec4 getDefaultColor( const in vec2 screenPosition ) {
			#if DIFFUSE_TEXTURE == 1
			return texture2D( tDiffuse, vUv );
			#else
			return vec4( 1.0 );
			#endif
		}

		float getDepth( const in vec2 screenPosition ) {
			#if DEPTH_PACKING == 1
			return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );
			#else
			return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		float getViewZ( const in float depth ) {
			#if PERSPECTIVE_CAMERA == 1
			return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );
			#else
			return orthographicDepthToViewZ( depth, cameraNear, cameraFar );
			#endif
		}

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {
			float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];
			vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );
			clipPosition *= clipW; // unprojection.

			return ( cameraInverseProjectionMatrix * clipPosition ).xyz;
		}

		vec3 getViewNormal( const in vec3 viewPosition, const in vec2 screenPosition ) {
			#if NORMAL_TEXTURE == 1
			return unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );
			#else
			return normalize( cross( dFdx( viewPosition ), dFdy( viewPosition ) ) );
			#endif
		}

		float scaleDividedByCameraFar;
		float minResolutionMultipliedByCameraFar;

		float getOcclusion( const in vec3 centerViewPosition, const in vec3 centerViewNormal, const in vec3 sampleViewPosition ) {
			vec3 viewDelta = sampleViewPosition - centerViewPosition;
			float viewDistance = length( viewDelta );
			float scaledScreenDistance = scaleDividedByCameraFar * viewDistance;

			return max(0.0, (dot(centerViewNormal, viewDelta) - minResolutionMultipliedByCameraFar) / scaledScreenDistance - bias) / (1.0 + pow2( scaledScreenDistance ) );
		}

		// moving costly divides into consts
		const float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );
		const float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );

		float getAmbientOcclusion( const in vec3 centerViewPosition ) {
			// precompute some variables require in getOcclusion.
			scaleDividedByCameraFar = scale / cameraFar;
			minResolutionMultipliedByCameraFar = minResolution * cameraFar;
			vec3 centerViewNormal = getViewNormal( centerViewPosition, vUv );

			// jsfiddle that shows sample pattern: https://jsfiddle.net/a16ff1p7/
			float angle = rand( vUv + randomSeed ) * PI2;
			vec2 radius = vec2( kernelRadius * INV_NUM_SAMPLES ) / size;
			vec2 radiusStep = radius;

			float occlusionSum = 0.0;
			float weightSum = 0.0;

			for( int i = 0; i < NUM_SAMPLES; i ++ ) {
				vec2 sampleUv = vUv + vec2( cos( angle ), sin( angle ) ) * radius;
				radius += radiusStep;
				angle += ANGLE_STEP;

				float sampleDepth = getDepth( sampleUv );
				if( sampleDepth >= ( 1.0 - EPSILON ) ) {
					continue;
				}

				float sampleViewZ = getViewZ( sampleDepth );
				vec3 sampleViewPosition = getViewPosition( sampleUv, sampleDepth, sampleViewZ );
				occlusionSum += getOcclusion( centerViewPosition, centerViewNormal, sampleViewPosition );
				weightSum += 1.0;
			}

			if( weightSum == 0.0 ) discard;

			return occlusionSum * ( intensity / weightSum );
		}

		void main() {
			float centerDepth = getDepth( vUv );
			if( centerDepth >= ( 1.0 - EPSILON ) ) {
				discard;
			}

			float centerViewZ = getViewZ( centerDepth );
			vec3 viewPosition = getViewPosition( vUv, centerDepth, centerViewZ );

			float ambientOcclusion = getAmbientOcclusion( viewPosition );

			gl_FragColor = getDefaultColor( vUv );
			gl_FragColor.xyz *=  1.0 - ambientOcclusion;
		}`
	};

	THREE.SAOShader = SAOShader;

} )();

;
( function () {

	/**
 * TODO
 */

	const DepthLimitedBlurShader = {
		defines: {
			'KERNEL_RADIUS': 4,
			'DEPTH_PACKING': 1,
			'PERSPECTIVE_CAMERA': 1
		},
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'size': {
				value: new THREE.Vector2( 512, 512 )
			},
			'sampleUvOffsets': {
				value: [ new THREE.Vector2( 0, 0 ) ]
			},
			'sampleWeights': {
				value: [ 1.0 ]
			},
			'tDepth': {
				value: null
			},
			'cameraNear': {
				value: 10
			},
			'cameraFar': {
				value: 1000
			},
			'depthCutoff': {
				value: 10
			}
		},
		vertexShader: /* glsl */`

		#include <common>

		uniform vec2 size;

		varying vec2 vUv;
		varying vec2 vInvSize;

		void main() {
			vUv = uv;
			vInvSize = 1.0 / size;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
		fragmentShader: /* glsl */`

		#include <common>
		#include <packing>

		uniform sampler2D tDiffuse;
		uniform sampler2D tDepth;

		uniform float cameraNear;
		uniform float cameraFar;
		uniform float depthCutoff;

		uniform vec2 sampleUvOffsets[ KERNEL_RADIUS + 1 ];
		uniform float sampleWeights[ KERNEL_RADIUS + 1 ];

		varying vec2 vUv;
		varying vec2 vInvSize;

		float getDepth( const in vec2 screenPosition ) {
			#if DEPTH_PACKING == 1
			return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );
			#else
			return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		float getViewZ( const in float depth ) {
			#if PERSPECTIVE_CAMERA == 1
			return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );
			#else
			return orthographicDepthToViewZ( depth, cameraNear, cameraFar );
			#endif
		}

		void main() {
			float depth = getDepth( vUv );
			if( depth >= ( 1.0 - EPSILON ) ) {
				discard;
			}

			float centerViewZ = -getViewZ( depth );
			bool rBreak = false, lBreak = false;

			float weightSum = sampleWeights[0];
			vec4 diffuseSum = texture2D( tDiffuse, vUv ) * weightSum;

			for( int i = 1; i <= KERNEL_RADIUS; i ++ ) {

				float sampleWeight = sampleWeights[i];
				vec2 sampleUvOffset = sampleUvOffsets[i] * vInvSize;

				vec2 sampleUv = vUv + sampleUvOffset;
				float viewZ = -getViewZ( getDepth( sampleUv ) );

				if( abs( viewZ - centerViewZ ) > depthCutoff ) rBreak = true;

				if( ! rBreak ) {
					diffuseSum += texture2D( tDiffuse, sampleUv ) * sampleWeight;
					weightSum += sampleWeight;
				}

				sampleUv = vUv - sampleUvOffset;
				viewZ = -getViewZ( getDepth( sampleUv ) );

				if( abs( viewZ - centerViewZ ) > depthCutoff ) lBreak = true;

				if( ! lBreak ) {
					diffuseSum += texture2D( tDiffuse, sampleUv ) * sampleWeight;
					weightSum += sampleWeight;
				}

			}

			gl_FragColor = diffuseSum / weightSum;
		}`
	};
	const BlurShaderUtils = {
		createSampleWeights: function ( kernelRadius, stdDev ) {

			const weights = [];
			for ( let i = 0; i <= kernelRadius; i ++ ) {

				weights.push( gaussian( i, stdDev ) );

			}

			return weights;

		},
		createSampleOffsets: function ( kernelRadius, uvIncrement ) {

			const offsets = [];
			for ( let i = 0; i <= kernelRadius; i ++ ) {

				offsets.push( uvIncrement.clone().multiplyScalar( i ) );

			}

			return offsets;

		},
		configure: function ( material, kernelRadius, stdDev, uvIncrement ) {

			material.defines[ 'KERNEL_RADIUS' ] = kernelRadius;
			material.uniforms[ 'sampleUvOffsets' ].value = BlurShaderUtils.createSampleOffsets( kernelRadius, uvIncrement );
			material.uniforms[ 'sampleWeights' ].value = BlurShaderUtils.createSampleWeights( kernelRadius, stdDev );
			material.needsUpdate = true;

		}
	};
	function gaussian( x, stdDev ) {

		return Math.exp( - ( x * x ) / ( 2.0 * ( stdDev * stdDev ) ) ) / ( Math.sqrt( 2.0 * Math.PI ) * stdDev );

	}

	THREE.BlurShaderUtils = BlurShaderUtils;
	THREE.DepthLimitedBlurShader = DepthLimitedBlurShader;

} )();

;
( function () {

	/**
 * Unpack RGBA depth shader
 * - show RGBA encoded depth as monochrome color
 */

	const UnpackDepthRGBAShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'opacity': {
				value: 1.0
			}
		},
		vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader: /* glsl */`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		#include <packing>

		void main() {

			float depth = 1.0 - unpackRGBAToDepth( texture2D( tDiffuse, vUv ) );
			gl_FragColor = vec4( vec3( depth ), opacity );

		}`
	};

	THREE.UnpackDepthRGBAShader = UnpackDepthRGBAShader;

} )();

;
( function () {

	class Pass {

		constructor() {

			// if set to true, the pass is processed by the composer
			this.enabled = true;

			// if set to true, the pass indicates to swap read and write buffer after rendering
			this.needsSwap = true;

			// if set to true, the pass clears its buffer before rendering
			this.clear = false;

			// if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.
			this.renderToScreen = false;

		}
		setSize() {}
		render() {

			console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

		}
		dispose() {}

	}

	// Helper for passes that need to fill the viewport with a single quad.

	const _camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

	// https://github.com/mrdoob/three.js/pull/21358

	const _geometry = new THREE.BufferGeometry();
	_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );
	_geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );
	class FullScreenQuad {

		constructor( material ) {

			this._mesh = new THREE.Mesh( _geometry, material );

		}
		dispose() {

			this._mesh.geometry.dispose();

		}
		render( renderer ) {

			renderer.render( this._mesh, _camera );

		}
		get material() {

			return this._mesh.material;

		}
		set material( value ) {

			this._mesh.material = value;

		}

	}

	THREE.FullScreenQuad = FullScreenQuad;
	THREE.Pass = Pass;

} )();

;
( function () {

	class MaskPass extends THREE.Pass {

		constructor( scene, camera ) {

			super();
			this.scene = scene;
			this.camera = camera;
			this.clear = true;
			this.needsSwap = false;
			this.inverse = false;

		}
		render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

			const context = renderer.getContext();
			const state = renderer.state;

			// don't update color or depth

			state.buffers.color.setMask( false );
			state.buffers.depth.setMask( false );

			// lock buffers

			state.buffers.color.setLocked( true );
			state.buffers.depth.setLocked( true );

			// set up stencil

			let writeValue, clearValue;
			if ( this.inverse ) {

				writeValue = 0;
				clearValue = 1;

			} else {

				writeValue = 1;
				clearValue = 0;

			}

			state.buffers.stencil.setTest( true );
			state.buffers.stencil.setOp( context.REPLACE, context.REPLACE, context.REPLACE );
			state.buffers.stencil.setFunc( context.ALWAYS, writeValue, 0xffffffff );
			state.buffers.stencil.setClear( clearValue );
			state.buffers.stencil.setLocked( true );

			// draw into the stencil buffer

			renderer.setRenderTarget( readBuffer );
			if ( this.clear ) renderer.clear();
			renderer.render( this.scene, this.camera );
			renderer.setRenderTarget( writeBuffer );
			if ( this.clear ) renderer.clear();
			renderer.render( this.scene, this.camera );

			// unlock color and depth buffer for subsequent rendering

			state.buffers.color.setLocked( false );
			state.buffers.depth.setLocked( false );

			// only render where stencil is set to 1

			state.buffers.stencil.setLocked( false );
			state.buffers.stencil.setFunc( context.EQUAL, 1, 0xffffffff ); // draw if == 1
			state.buffers.stencil.setOp( context.KEEP, context.KEEP, context.KEEP );
			state.buffers.stencil.setLocked( true );

		}

	}
	class ClearMaskPass extends THREE.Pass {

		constructor() {

			super();
			this.needsSwap = false;

		}
		render( renderer /*, writeBuffer, readBuffer, deltaTime, maskActive */ ) {

			renderer.state.buffers.stencil.setLocked( false );
			renderer.state.buffers.stencil.setTest( false );

		}

	}

	THREE.ClearMaskPass = ClearMaskPass;
	THREE.MaskPass = MaskPass;

} )();

;
( function () {

	class EffectComposer {

		constructor( renderer, renderTarget ) {

			this.renderer = renderer;
			if ( renderTarget === undefined ) {

				const size = renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = new THREE.WebGLRenderTarget( this._width * this._pixelRatio, this._height * this._pixelRatio );
				renderTarget.texture.name = 'EffectComposer.rt1';

			} else {

				this._pixelRatio = 1;
				this._width = renderTarget.width;
				this._height = renderTarget.height;

			}

			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.renderTarget2.texture.name = 'EffectComposer.rt2';
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;
			this.renderToScreen = true;
			this.passes = [];

			// dependencies

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.CopyShader' );

			}

			if ( THREE.ShaderPass === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.ShaderPass' );

			}

			this.copyPass = new THREE.ShaderPass( THREE.CopyShader );
			this.clock = new THREE.Clock();

		}
		swapBuffers() {

			const tmp = this.readBuffer;
			this.readBuffer = this.writeBuffer;
			this.writeBuffer = tmp;

		}
		addPass( pass ) {

			this.passes.push( pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}
		insertPass( pass, index ) {

			this.passes.splice( index, 0, pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}
		removePass( pass ) {

			const index = this.passes.indexOf( pass );
			if ( index !== - 1 ) {

				this.passes.splice( index, 1 );

			}

		}
		isLastEnabledPass( passIndex ) {

			for ( let i = passIndex + 1; i < this.passes.length; i ++ ) {

				if ( this.passes[ i ].enabled ) {

					return false;

				}

			}

			return true;

		}
		render( deltaTime ) {

			// deltaTime value is in seconds

			if ( deltaTime === undefined ) {

				deltaTime = this.clock.getDelta();

			}

			const currentRenderTarget = this.renderer.getRenderTarget();
			let maskActive = false;
			for ( let i = 0, il = this.passes.length; i < il; i ++ ) {

				const pass = this.passes[ i ];
				if ( pass.enabled === false ) continue;
				pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass( i );
				pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );
				if ( pass.needsSwap ) {

					if ( maskActive ) {

						const context = this.renderer.getContext();
						const stencil = this.renderer.state.buffers.stencil;

						//context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );
						stencil.setFunc( context.NOTEQUAL, 1, 0xffffffff );
						this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime );

						//context.stencilFunc( context.EQUAL, 1, 0xffffffff );
						stencil.setFunc( context.EQUAL, 1, 0xffffffff );

					}

					this.swapBuffers();

				}

				if ( THREE.MaskPass !== undefined ) {

					if ( pass instanceof THREE.MaskPass ) {

						maskActive = true;

					} else if ( pass instanceof THREE.ClearMaskPass ) {

						maskActive = false;

					}

				}

			}

			this.renderer.setRenderTarget( currentRenderTarget );

		}
		reset( renderTarget ) {

			if ( renderTarget === undefined ) {

				const size = this.renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = this.renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = this.renderTarget1.clone();
				renderTarget.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

			}

			this.renderTarget1.dispose();
			this.renderTarget2.dispose();
			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;

		}
		setSize( width, height ) {

			this._width = width;
			this._height = height;
			const effectiveWidth = this._width * this._pixelRatio;
			const effectiveHeight = this._height * this._pixelRatio;
			this.renderTarget1.setSize( effectiveWidth, effectiveHeight );
			this.renderTarget2.setSize( effectiveWidth, effectiveHeight );
			for ( let i = 0; i < this.passes.length; i ++ ) {

				this.passes[ i ].setSize( effectiveWidth, effectiveHeight );

			}

		}
		setPixelRatio( pixelRatio ) {

			this._pixelRatio = pixelRatio;
			this.setSize( this._width, this._height );

		}
		dispose() {

			this.renderTarget1.dispose();
			this.renderTarget2.dispose();
			this.copyPass.dispose();

		}

	}
	class Pass {

		constructor() {

			// if set to true, the pass is processed by the composer
			this.enabled = true;

			// if set to true, the pass indicates to swap read and write buffer after rendering
			this.needsSwap = true;

			// if set to true, the pass clears its buffer before rendering
			this.clear = false;

			// if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.
			this.renderToScreen = false;

		}
		setSize() {}
		render() {

			console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

		}

	}

	// Helper for passes that need to fill the viewport with a single quad.

	const _camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

	// https://github.com/mrdoob/three.js/pull/21358

	const _geometry = new THREE.BufferGeometry();
	_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );
	_geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );
	class FullScreenQuad {

		constructor( material ) {

			this._mesh = new THREE.Mesh( _geometry, material );

		}
		dispose() {

			this._mesh.geometry.dispose();

		}
		render( renderer ) {

			renderer.render( this._mesh, _camera );

		}
		get material() {

			return this._mesh.material;

		}
		set material( value ) {

			this._mesh.material = value;

		}

	}

	THREE.EffectComposer = EffectComposer;
	THREE.FullScreenQuad = FullScreenQuad;
	THREE.Pass = Pass;

} )();

;
( function () {

	class RenderPass extends THREE.Pass {

		constructor( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

			super();
			this.scene = scene;
			this.camera = camera;
			this.overrideMaterial = overrideMaterial;
			this.clearColor = clearColor;
			this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0;
			this.clear = true;
			this.clearDepth = false;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();

		}
		render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			let oldClearAlpha, oldOverrideMaterial;
			if ( this.overrideMaterial !== undefined ) {

				oldOverrideMaterial = this.scene.overrideMaterial;
				this.scene.overrideMaterial = this.overrideMaterial;

			}

			if ( this.clearColor ) {

				renderer.getClearColor( this._oldClearColor );
				oldClearAlpha = renderer.getClearAlpha();
				renderer.setClearColor( this.clearColor, this.clearAlpha );

			}

			if ( this.clearDepth ) {

				renderer.clearDepth();

			}

			renderer.setRenderTarget( this.renderToScreen ? null : readBuffer );

			// TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
			if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
			renderer.render( this.scene, this.camera );
			if ( this.clearColor ) {

				renderer.setClearColor( this._oldClearColor, oldClearAlpha );

			}

			if ( this.overrideMaterial !== undefined ) {

				this.scene.overrideMaterial = oldOverrideMaterial;

			}

			renderer.autoClear = oldAutoClear;

		}

	}

	THREE.RenderPass = RenderPass;

} )();

;
( function () {

	class ShaderPass extends THREE.Pass {

		constructor( shader, textureID ) {

			super();
			this.textureID = textureID !== undefined ? textureID : 'tDiffuse';
			if ( shader instanceof THREE.ShaderMaterial ) {

				this.uniforms = shader.uniforms;
				this.material = shader;

			} else if ( shader ) {

				this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
				this.material = new THREE.ShaderMaterial( {
					defines: Object.assign( {}, shader.defines ),
					uniforms: this.uniforms,
					vertexShader: shader.vertexShader,
					fragmentShader: shader.fragmentShader
				} );

			}

			this.fsQuad = new THREE.FullScreenQuad( this.material );

		}
		render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

			if ( this.uniforms[ this.textureID ] ) {

				this.uniforms[ this.textureID ].value = readBuffer.texture;

			}

			this.fsQuad.material = this.material;
			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( writeBuffer );
				// TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
				if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
				this.fsQuad.render( renderer );

			}

		}
		dispose() {

			this.material.dispose();
			this.fsQuad.dispose();

		}

	}

	THREE.ShaderPass = ShaderPass;

} )();

;
( function () {

	/**
 * SAO implementation inspired from bhouston previous SAO work
 */

	class SAOPass extends THREE.Pass {

		constructor( scene, camera, useDepthTexture = false, useNormals = false, resolution = new THREE.Vector2( 256, 256 ) ) {

			super();
			this.scene = scene;
			this.camera = camera;
			this.clear = true;
			this.needsSwap = false;
			this.supportsDepthTextureExtension = useDepthTexture;
			this.supportsNormalTexture = useNormals;
			this.originalClearColor = new THREE.Color();
			this._oldClearColor = new THREE.Color();
			this.oldClearAlpha = 1;
			this.params = {
				output: 0,
				saoBias: 0.5,
				saoIntensity: 0.18,
				saoScale: 1,
				saoKernelRadius: 100,
				saoMinResolution: 0,
				saoBlur: true,
				saoBlurRadius: 8,
				saoBlurStdDev: 4,
				saoBlurDepthCutoff: 0.01
			};
			this.resolution = new THREE.Vector2( resolution.x, resolution.y );
			this.saoRenderTarget = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y );
			this.blurIntermediateRenderTarget = this.saoRenderTarget.clone();
			this.beautyRenderTarget = this.saoRenderTarget.clone();
			this.normalRenderTarget = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y, {
				minFilter: THREE.NearestFilter,
				magFilter: THREE.NearestFilter
			} );
			this.depthRenderTarget = this.normalRenderTarget.clone();
			let depthTexture;
			if ( this.supportsDepthTextureExtension ) {

				depthTexture = new THREE.DepthTexture();
				depthTexture.type = THREE.UnsignedShortType;
				this.beautyRenderTarget.depthTexture = depthTexture;
				this.beautyRenderTarget.depthBuffer = true;

			}

			this.depthMaterial = new THREE.MeshDepthMaterial();
			this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
			this.depthMaterial.blending = THREE.NoBlending;
			this.normalMaterial = new THREE.MeshNormalMaterial();
			this.normalMaterial.blending = THREE.NoBlending;
			if ( THREE.SAOShader === undefined ) {

				console.error( 'THREE.SAOPass relies on THREE.SAOShader' );

			}

			this.saoMaterial = new THREE.ShaderMaterial( {
				defines: Object.assign( {}, THREE.SAOShader.defines ),
				fragmentShader: THREE.SAOShader.fragmentShader,
				vertexShader: THREE.SAOShader.vertexShader,
				uniforms: THREE.UniformsUtils.clone( THREE.SAOShader.uniforms )
			} );
			this.saoMaterial.extensions.derivatives = true;
			this.saoMaterial.defines[ 'DEPTH_PACKING' ] = this.supportsDepthTextureExtension ? 0 : 1;
			this.saoMaterial.defines[ 'NORMAL_TEXTURE' ] = this.supportsNormalTexture ? 1 : 0;
			this.saoMaterial.defines[ 'PERSPECTIVE_CAMERA' ] = this.camera.isPerspectiveCamera ? 1 : 0;
			this.saoMaterial.uniforms[ 'tDepth' ].value = this.supportsDepthTextureExtension ? depthTexture : this.depthRenderTarget.texture;
			this.saoMaterial.uniforms[ 'tNormal' ].value = this.normalRenderTarget.texture;
			this.saoMaterial.uniforms[ 'size' ].value.set( this.resolution.x, this.resolution.y );
			this.saoMaterial.uniforms[ 'cameraInverseProjectionMatrix' ].value.copy( this.camera.projectionMatrixInverse );
			this.saoMaterial.uniforms[ 'cameraProjectionMatrix' ].value = this.camera.projectionMatrix;
			this.saoMaterial.blending = THREE.NoBlending;
			if ( THREE.DepthLimitedBlurShader === undefined ) {

				console.error( 'THREE.SAOPass relies on THREE.DepthLimitedBlurShader' );

			}

			this.vBlurMaterial = new THREE.ShaderMaterial( {
				uniforms: THREE.UniformsUtils.clone( THREE.DepthLimitedBlurShader.uniforms ),
				defines: Object.assign( {}, THREE.DepthLimitedBlurShader.defines ),
				vertexShader: THREE.DepthLimitedBlurShader.vertexShader,
				fragmentShader: THREE.DepthLimitedBlurShader.fragmentShader
			} );
			this.vBlurMaterial.defines[ 'DEPTH_PACKING' ] = this.supportsDepthTextureExtension ? 0 : 1;
			this.vBlurMaterial.defines[ 'PERSPECTIVE_CAMERA' ] = this.camera.isPerspectiveCamera ? 1 : 0;
			this.vBlurMaterial.uniforms[ 'tDiffuse' ].value = this.saoRenderTarget.texture;
			this.vBlurMaterial.uniforms[ 'tDepth' ].value = this.supportsDepthTextureExtension ? depthTexture : this.depthRenderTarget.texture;
			this.vBlurMaterial.uniforms[ 'size' ].value.set( this.resolution.x, this.resolution.y );
			this.vBlurMaterial.blending = THREE.NoBlending;
			this.hBlurMaterial = new THREE.ShaderMaterial( {
				uniforms: THREE.UniformsUtils.clone( THREE.DepthLimitedBlurShader.uniforms ),
				defines: Object.assign( {}, THREE.DepthLimitedBlurShader.defines ),
				vertexShader: THREE.DepthLimitedBlurShader.vertexShader,
				fragmentShader: THREE.DepthLimitedBlurShader.fragmentShader
			} );
			this.hBlurMaterial.defines[ 'DEPTH_PACKING' ] = this.supportsDepthTextureExtension ? 0 : 1;
			this.hBlurMaterial.defines[ 'PERSPECTIVE_CAMERA' ] = this.camera.isPerspectiveCamera ? 1 : 0;
			this.hBlurMaterial.uniforms[ 'tDiffuse' ].value = this.blurIntermediateRenderTarget.texture;
			this.hBlurMaterial.uniforms[ 'tDepth' ].value = this.supportsDepthTextureExtension ? depthTexture : this.depthRenderTarget.texture;
			this.hBlurMaterial.uniforms[ 'size' ].value.set( this.resolution.x, this.resolution.y );
			this.hBlurMaterial.blending = THREE.NoBlending;
			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.SAOPass relies on THREE.CopyShader' );

			}

			this.materialCopy = new THREE.ShaderMaterial( {
				uniforms: THREE.UniformsUtils.clone( THREE.CopyShader.uniforms ),
				vertexShader: THREE.CopyShader.vertexShader,
				fragmentShader: THREE.CopyShader.fragmentShader,
				blending: THREE.NoBlending
			} );
			this.materialCopy.transparent = true;
			this.materialCopy.depthTest = false;
			this.materialCopy.depthWrite = false;
			this.materialCopy.blending = THREE.CustomBlending;
			this.materialCopy.blendSrc = THREE.DstColorFactor;
			this.materialCopy.blendDst = THREE.ZeroFactor;
			this.materialCopy.blendEquation = THREE.AddEquation;
			this.materialCopy.blendSrcAlpha = THREE.DstAlphaFactor;
			this.materialCopy.blendDstAlpha = THREE.ZeroFactor;
			this.materialCopy.blendEquationAlpha = THREE.AddEquation;
			if ( THREE.UnpackDepthRGBAShader === undefined ) {

				console.error( 'THREE.SAOPass relies on THREE.UnpackDepthRGBAShader' );

			}

			this.depthCopy = new THREE.ShaderMaterial( {
				uniforms: THREE.UniformsUtils.clone( THREE.UnpackDepthRGBAShader.uniforms ),
				vertexShader: THREE.UnpackDepthRGBAShader.vertexShader,
				fragmentShader: THREE.UnpackDepthRGBAShader.fragmentShader,
				blending: THREE.NoBlending
			} );
			this.fsQuad = new THREE.FullScreenQuad( null );

		}
		render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive*/ ) {

			// Rendering readBuffer first when rendering to screen
			if ( this.renderToScreen ) {

				this.materialCopy.blending = THREE.NoBlending;
				this.materialCopy.uniforms[ 'tDiffuse' ].value = readBuffer.texture;
				this.materialCopy.needsUpdate = true;
				this.renderPass( renderer, this.materialCopy, null );

			}

			if ( this.params.output === 1 ) {

				return;

			}

			renderer.getClearColor( this._oldClearColor );
			this.oldClearAlpha = renderer.getClearAlpha();
			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			renderer.setRenderTarget( this.depthRenderTarget );
			renderer.clear();
			this.saoMaterial.uniforms[ 'bias' ].value = this.params.saoBias;
			this.saoMaterial.uniforms[ 'intensity' ].value = this.params.saoIntensity;
			this.saoMaterial.uniforms[ 'scale' ].value = this.params.saoScale;
			this.saoMaterial.uniforms[ 'kernelRadius' ].value = this.params.saoKernelRadius;
			this.saoMaterial.uniforms[ 'minResolution' ].value = this.params.saoMinResolution;
			this.saoMaterial.uniforms[ 'cameraNear' ].value = this.camera.near;
			this.saoMaterial.uniforms[ 'cameraFar' ].value = this.camera.far;
			// this.saoMaterial.uniforms['randomSeed'].value = Math.random();

			const depthCutoff = this.params.saoBlurDepthCutoff * ( this.camera.far - this.camera.near );
			this.vBlurMaterial.uniforms[ 'depthCutoff' ].value = depthCutoff;
			this.hBlurMaterial.uniforms[ 'depthCutoff' ].value = depthCutoff;
			this.vBlurMaterial.uniforms[ 'cameraNear' ].value = this.camera.near;
			this.vBlurMaterial.uniforms[ 'cameraFar' ].value = this.camera.far;
			this.hBlurMaterial.uniforms[ 'cameraNear' ].value = this.camera.near;
			this.hBlurMaterial.uniforms[ 'cameraFar' ].value = this.camera.far;
			this.params.saoBlurRadius = Math.floor( this.params.saoBlurRadius );
			if ( this.prevStdDev !== this.params.saoBlurStdDev || this.prevNumSamples !== this.params.saoBlurRadius ) {

				THREE.BlurShaderUtils.configure( this.vBlurMaterial, this.params.saoBlurRadius, this.params.saoBlurStdDev, new THREE.Vector2( 0, 1 ) );
				THREE.BlurShaderUtils.configure( this.hBlurMaterial, this.params.saoBlurRadius, this.params.saoBlurStdDev, new THREE.Vector2( 1, 0 ) );
				this.prevStdDev = this.params.saoBlurStdDev;
				this.prevNumSamples = this.params.saoBlurRadius;

			}

			// Rendering scene to depth texture
			renderer.setClearColor( 0x000000 );
			renderer.setRenderTarget( this.beautyRenderTarget );
			renderer.clear();
			renderer.render( this.scene, this.camera );

			// Re-render scene if depth texture extension is not supported
			if ( ! this.supportsDepthTextureExtension ) {

				// Clear rule : far clipping plane in both RGBA and Basic encoding
				this.renderOverride( renderer, this.depthMaterial, this.depthRenderTarget, 0x000000, 1.0 );

			}

			if ( this.supportsNormalTexture ) {

				// Clear rule : default normal is facing the camera
				this.renderOverride( renderer, this.normalMaterial, this.normalRenderTarget, 0x7777ff, 1.0 );

			}

			// Rendering SAO texture
			this.renderPass( renderer, this.saoMaterial, this.saoRenderTarget, 0xffffff, 1.0 );

			// Blurring SAO texture
			if ( this.params.saoBlur ) {

				this.renderPass( renderer, this.vBlurMaterial, this.blurIntermediateRenderTarget, 0xffffff, 1.0 );
				this.renderPass( renderer, this.hBlurMaterial, this.saoRenderTarget, 0xffffff, 1.0 );

			}

			let outputMaterial = this.materialCopy;
			// Setting up SAO rendering
			if ( this.params.output === 3 ) {

				if ( this.supportsDepthTextureExtension ) {

					this.materialCopy.uniforms[ 'tDiffuse' ].value = this.beautyRenderTarget.depthTexture;
					this.materialCopy.needsUpdate = true;

				} else {

					this.depthCopy.uniforms[ 'tDiffuse' ].value = this.depthRenderTarget.texture;
					this.depthCopy.needsUpdate = true;
					outputMaterial = this.depthCopy;

				}

			} else if ( this.params.output === 4 ) {

				this.materialCopy.uniforms[ 'tDiffuse' ].value = this.normalRenderTarget.texture;
				this.materialCopy.needsUpdate = true;

			} else {

				this.materialCopy.uniforms[ 'tDiffuse' ].value = this.saoRenderTarget.texture;
				this.materialCopy.needsUpdate = true;

			}

			// Blending depends on output, only want a THREE.CustomBlending when showing SAO
			if ( this.params.output === 0 ) {

				outputMaterial.blending = THREE.CustomBlending;

			} else {

				outputMaterial.blending = THREE.NoBlending;

			}

			// Rendering SAOPass result on top of previous pass
			this.renderPass( renderer, outputMaterial, this.renderToScreen ? null : readBuffer );
			renderer.setClearColor( this._oldClearColor, this.oldClearAlpha );
			renderer.autoClear = oldAutoClear;

		}
		renderPass( renderer, passMaterial, renderTarget, clearColor, clearAlpha ) {

			// save original state
			renderer.getClearColor( this.originalClearColor );
			const originalClearAlpha = renderer.getClearAlpha();
			const originalAutoClear = renderer.autoClear;
			renderer.setRenderTarget( renderTarget );

			// setup pass state
			renderer.autoClear = false;
			if ( clearColor !== undefined && clearColor !== null ) {

				renderer.setClearColor( clearColor );
				renderer.setClearAlpha( clearAlpha || 0.0 );
				renderer.clear();

			}

			this.fsQuad.material = passMaterial;
			this.fsQuad.render( renderer );

			// restore original state
			renderer.autoClear = originalAutoClear;
			renderer.setClearColor( this.originalClearColor );
			renderer.setClearAlpha( originalClearAlpha );

		}
		renderOverride( renderer, overrideMaterial, renderTarget, clearColor, clearAlpha ) {

			renderer.getClearColor( this.originalClearColor );
			const originalClearAlpha = renderer.getClearAlpha();
			const originalAutoClear = renderer.autoClear;
			renderer.setRenderTarget( renderTarget );
			renderer.autoClear = false;
			clearColor = overrideMaterial.clearColor || clearColor;
			clearAlpha = overrideMaterial.clearAlpha || clearAlpha;
			if ( clearColor !== undefined && clearColor !== null ) {

				renderer.setClearColor( clearColor );
				renderer.setClearAlpha( clearAlpha || 0.0 );
				renderer.clear();

			}

			this.scene.overrideMaterial = overrideMaterial;
			renderer.render( this.scene, this.camera );
			this.scene.overrideMaterial = null;

			// restore original state
			renderer.autoClear = originalAutoClear;
			renderer.setClearColor( this.originalClearColor );
			renderer.setClearAlpha( originalClearAlpha );

		}
		setSize( width, height ) {

			this.beautyRenderTarget.setSize( width, height );
			this.saoRenderTarget.setSize( width, height );
			this.blurIntermediateRenderTarget.setSize( width, height );
			this.normalRenderTarget.setSize( width, height );
			this.depthRenderTarget.setSize( width, height );
			this.saoMaterial.uniforms[ 'size' ].value.set( width, height );
			this.saoMaterial.uniforms[ 'cameraInverseProjectionMatrix' ].value.copy( this.camera.projectionMatrixInverse );
			this.saoMaterial.uniforms[ 'cameraProjectionMatrix' ].value = this.camera.projectionMatrix;
			this.saoMaterial.needsUpdate = true;
			this.vBlurMaterial.uniforms[ 'size' ].value.set( width, height );
			this.vBlurMaterial.needsUpdate = true;
			this.hBlurMaterial.uniforms[ 'size' ].value.set( width, height );
			this.hBlurMaterial.needsUpdate = true;

		}
		dispose() {

			this.saoRenderTarget.dispose();
			this.blurIntermediateRenderTarget.dispose();
			this.beautyRenderTarget.dispose();
			this.normalRenderTarget.dispose();
			this.depthRenderTarget.dispose();
			this.depthMaterial.dispose();
			this.normalMaterial.dispose();
			this.saoMaterial.dispose();
			this.vBlurMaterial.dispose();
			this.hBlurMaterial.dispose();
			this.materialCopy.dispose();
			this.depthCopy.dispose();
			this.fsQuad.dispose();

		}

	}
	SAOPass.OUTPUT = {
		'Beauty': 1,
		'Default': 0,
		'SAO': 2,
		'Depth': 3,
		'Normal': 4
	};

	THREE.SAOPass = SAOPass;

} )();

;
( function () {

	class OutlinePass extends THREE.Pass {

		constructor( resolution, scene, camera, selectedObjects ) {

			super();
			this.renderScene = scene;
			this.renderCamera = camera;
			this.selectedObjects = selectedObjects !== undefined ? selectedObjects : [];
			this.visibleEdgeColor = new THREE.Color( 1, 1, 1 );
			this.hiddenEdgeColor = new THREE.Color( 0.1, 0.04, 0.02 );
			this.edgeGlow = 0.0;
			this.usePatternTexture = false;
			this.edgeThickness = 1.0;
			this.edgeStrength = 3.0;
			this.downSampleRatio = 2;
			this.pulsePeriod = 0;
			this._visibilityCache = new Map();
			this.resolution = resolution !== undefined ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 );
			const resx = Math.round( this.resolution.x / this.downSampleRatio );
			const resy = Math.round( this.resolution.y / this.downSampleRatio );
			this.renderTargetMaskBuffer = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y );
			this.renderTargetMaskBuffer.texture.name = 'OutlinePass.mask';
			this.renderTargetMaskBuffer.texture.generateMipmaps = false;
			this.depthMaterial = new THREE.MeshDepthMaterial();
			this.depthMaterial.side = THREE.DoubleSide;
			this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
			this.depthMaterial.blending = THREE.NoBlending;
			this.prepareMaskMaterial = this.getPrepareMaskMaterial();
			this.prepareMaskMaterial.side = THREE.DoubleSide;
			this.prepareMaskMaterial.fragmentShader = replaceDepthToViewZ( this.prepareMaskMaterial.fragmentShader, this.renderCamera );
			this.renderTargetDepthBuffer = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y );
			this.renderTargetDepthBuffer.texture.name = 'OutlinePass.depth';
			this.renderTargetDepthBuffer.texture.generateMipmaps = false;
			this.renderTargetMaskDownSampleBuffer = new THREE.WebGLRenderTarget( resx, resy );
			this.renderTargetMaskDownSampleBuffer.texture.name = 'OutlinePass.depthDownSample';
			this.renderTargetMaskDownSampleBuffer.texture.generateMipmaps = false;
			this.renderTargetBlurBuffer1 = new THREE.WebGLRenderTarget( resx, resy );
			this.renderTargetBlurBuffer1.texture.name = 'OutlinePass.blur1';
			this.renderTargetBlurBuffer1.texture.generateMipmaps = false;
			this.renderTargetBlurBuffer2 = new THREE.WebGLRenderTarget( Math.round( resx / 2 ), Math.round( resy / 2 ) );
			this.renderTargetBlurBuffer2.texture.name = 'OutlinePass.blur2';
			this.renderTargetBlurBuffer2.texture.generateMipmaps = false;
			this.edgeDetectionMaterial = this.getEdgeDetectionMaterial();
			this.renderTargetEdgeBuffer1 = new THREE.WebGLRenderTarget( resx, resy );
			this.renderTargetEdgeBuffer1.texture.name = 'OutlinePass.edge1';
			this.renderTargetEdgeBuffer1.texture.generateMipmaps = false;
			this.renderTargetEdgeBuffer2 = new THREE.WebGLRenderTarget( Math.round( resx / 2 ), Math.round( resy / 2 ) );
			this.renderTargetEdgeBuffer2.texture.name = 'OutlinePass.edge2';
			this.renderTargetEdgeBuffer2.texture.generateMipmaps = false;
			const MAX_EDGE_THICKNESS = 4;
			const MAX_EDGE_GLOW = 4;
			this.separableBlurMaterial1 = this.getSeperableBlurMaterial( MAX_EDGE_THICKNESS );
			this.separableBlurMaterial1.uniforms[ 'texSize' ].value.set( resx, resy );
			this.separableBlurMaterial1.uniforms[ 'kernelRadius' ].value = 1;
			this.separableBlurMaterial2 = this.getSeperableBlurMaterial( MAX_EDGE_GLOW );
			this.separableBlurMaterial2.uniforms[ 'texSize' ].value.set( Math.round( resx / 2 ), Math.round( resy / 2 ) );
			this.separableBlurMaterial2.uniforms[ 'kernelRadius' ].value = MAX_EDGE_GLOW;

			// Overlay material
			this.overlayMaterial = this.getOverlayMaterial();

			// copy material
			if ( THREE.CopyShader === undefined ) console.error( 'THREE.OutlinePass relies on THREE.CopyShader' );
			const copyShader = THREE.CopyShader;
			this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
			this.copyUniforms[ 'opacity' ].value = 1.0;
			this.materialCopy = new THREE.ShaderMaterial( {
				uniforms: this.copyUniforms,
				vertexShader: copyShader.vertexShader,
				fragmentShader: copyShader.fragmentShader,
				blending: THREE.NoBlending,
				depthTest: false,
				depthWrite: false,
				transparent: true
			} );
			this.enabled = true;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();
			this.oldClearAlpha = 1;
			this.fsQuad = new THREE.FullScreenQuad( null );
			this.tempPulseColor1 = new THREE.Color();
			this.tempPulseColor2 = new THREE.Color();
			this.textureMatrix = new THREE.Matrix4();
			function replaceDepthToViewZ( string, camera ) {

				const type = camera.isPerspectiveCamera ? 'perspective' : 'orthographic';
				return string.replace( /DEPTH_TO_VIEW_Z/g, type + 'DepthToViewZ' );

			}

		}
		dispose() {

			this.renderTargetMaskBuffer.dispose();
			this.renderTargetDepthBuffer.dispose();
			this.renderTargetMaskDownSampleBuffer.dispose();
			this.renderTargetBlurBuffer1.dispose();
			this.renderTargetBlurBuffer2.dispose();
			this.renderTargetEdgeBuffer1.dispose();
			this.renderTargetEdgeBuffer2.dispose();
			this.depthMaterial.dispose();
			this.prepareMaskMaterial.dispose();
			this.edgeDetectionMaterial.dispose();
			this.separableBlurMaterial1.dispose();
			this.separableBlurMaterial2.dispose();
			this.overlayMaterial.dispose();
			this.materialCopy.dispose();
			this.fsQuad.dispose();

		}
		setSize( width, height ) {

			this.renderTargetMaskBuffer.setSize( width, height );
			this.renderTargetDepthBuffer.setSize( width, height );
			let resx = Math.round( width / this.downSampleRatio );
			let resy = Math.round( height / this.downSampleRatio );
			this.renderTargetMaskDownSampleBuffer.setSize( resx, resy );
			this.renderTargetBlurBuffer1.setSize( resx, resy );
			this.renderTargetEdgeBuffer1.setSize( resx, resy );
			this.separableBlurMaterial1.uniforms[ 'texSize' ].value.set( resx, resy );
			resx = Math.round( resx / 2 );
			resy = Math.round( resy / 2 );
			this.renderTargetBlurBuffer2.setSize( resx, resy );
			this.renderTargetEdgeBuffer2.setSize( resx, resy );
			this.separableBlurMaterial2.uniforms[ 'texSize' ].value.set( resx, resy );

		}
		changeVisibilityOfSelectedObjects( bVisible ) {

			const cache = this._visibilityCache;
			function gatherSelectedMeshesCallBack( object ) {

				if ( object.isMesh ) {

					if ( bVisible === true ) {

						object.visible = cache.get( object );

					} else {

						cache.set( object, object.visible );
						object.visible = bVisible;

					}

				}

			}

			for ( let i = 0; i < this.selectedObjects.length; i ++ ) {

				const selectedObject = this.selectedObjects[ i ];
				selectedObject.traverse( gatherSelectedMeshesCallBack );

			}

		}
		changeVisibilityOfNonSelectedObjects( bVisible ) {

			const cache = this._visibilityCache;
			const selectedMeshes = [];
			function gatherSelectedMeshesCallBack( object ) {

				if ( object.isMesh ) selectedMeshes.push( object );

			}

			for ( let i = 0; i < this.selectedObjects.length; i ++ ) {

				const selectedObject = this.selectedObjects[ i ];
				selectedObject.traverse( gatherSelectedMeshesCallBack );

			}

			function VisibilityChangeCallBack( object ) {

				if ( object.isMesh || object.isSprite ) {

					// only meshes and sprites are supported by OutlinePass

					let bFound = false;
					for ( let i = 0; i < selectedMeshes.length; i ++ ) {

						const selectedObjectId = selectedMeshes[ i ].id;
						if ( selectedObjectId === object.id ) {

							bFound = true;
							break;

						}

					}

					if ( bFound === false ) {

						const visibility = object.visible;
						if ( bVisible === false || cache.get( object ) === true ) {

							object.visible = bVisible;

						}

						cache.set( object, visibility );

					}

				} else if ( object.isPoints || object.isLine ) {

					// the visibilty of points and lines is always set to false in order to
					// not affect the outline computation

					if ( bVisible === true ) {

						object.visible = cache.get( object ); // restore

					} else {

						cache.set( object, object.visible );
						object.visible = bVisible;

					}

				}

			}

			this.renderScene.traverse( VisibilityChangeCallBack );

		}
		updateTextureMatrix() {

			this.textureMatrix.set( 0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0 );
			this.textureMatrix.multiply( this.renderCamera.projectionMatrix );
			this.textureMatrix.multiply( this.renderCamera.matrixWorldInverse );

		}
		render( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

			if ( this.selectedObjects.length > 0 ) {

				renderer.getClearColor( this._oldClearColor );
				this.oldClearAlpha = renderer.getClearAlpha();
				const oldAutoClear = renderer.autoClear;
				renderer.autoClear = false;
				if ( maskActive ) renderer.state.buffers.stencil.setTest( false );
				renderer.setClearColor( 0xffffff, 1 );

				// Make selected objects invisible
				this.changeVisibilityOfSelectedObjects( false );
				const currentBackground = this.renderScene.background;
				this.renderScene.background = null;

				// 1. Draw Non Selected objects in the depth buffer
				this.renderScene.overrideMaterial = this.depthMaterial;
				renderer.setRenderTarget( this.renderTargetDepthBuffer );
				renderer.clear();
				renderer.render( this.renderScene, this.renderCamera );

				// Make selected objects visible
				this.changeVisibilityOfSelectedObjects( true );
				this._visibilityCache.clear();

				// Update Texture Matrix for Depth compare
				this.updateTextureMatrix();

				// Make non selected objects invisible, and draw only the selected objects, by comparing the depth buffer of non selected objects
				this.changeVisibilityOfNonSelectedObjects( false );
				this.renderScene.overrideMaterial = this.prepareMaskMaterial;
				this.prepareMaskMaterial.uniforms[ 'cameraNearFar' ].value.set( this.renderCamera.near, this.renderCamera.far );
				this.prepareMaskMaterial.uniforms[ 'depthTexture' ].value = this.renderTargetDepthBuffer.texture;
				this.prepareMaskMaterial.uniforms[ 'textureMatrix' ].value = this.textureMatrix;
				renderer.setRenderTarget( this.renderTargetMaskBuffer );
				renderer.clear();
				renderer.render( this.renderScene, this.renderCamera );
				this.renderScene.overrideMaterial = null;
				this.changeVisibilityOfNonSelectedObjects( true );
				this._visibilityCache.clear();
				this.renderScene.background = currentBackground;

				// 2. Downsample to Half resolution
				this.fsQuad.material = this.materialCopy;
				this.copyUniforms[ 'tDiffuse' ].value = this.renderTargetMaskBuffer.texture;
				renderer.setRenderTarget( this.renderTargetMaskDownSampleBuffer );
				renderer.clear();
				this.fsQuad.render( renderer );
				this.tempPulseColor1.copy( this.visibleEdgeColor );
				this.tempPulseColor2.copy( this.hiddenEdgeColor );
				if ( this.pulsePeriod > 0 ) {

					const scalar = ( 1 + 0.25 ) / 2 + Math.cos( performance.now() * 0.01 / this.pulsePeriod ) * ( 1.0 - 0.25 ) / 2;
					this.tempPulseColor1.multiplyScalar( scalar );
					this.tempPulseColor2.multiplyScalar( scalar );

				}

				// 3. Apply Edge Detection THREE.Pass
				this.fsQuad.material = this.edgeDetectionMaterial;
				this.edgeDetectionMaterial.uniforms[ 'maskTexture' ].value = this.renderTargetMaskDownSampleBuffer.texture;
				this.edgeDetectionMaterial.uniforms[ 'texSize' ].value.set( this.renderTargetMaskDownSampleBuffer.width, this.renderTargetMaskDownSampleBuffer.height );
				this.edgeDetectionMaterial.uniforms[ 'visibleEdgeColor' ].value = this.tempPulseColor1;
				this.edgeDetectionMaterial.uniforms[ 'hiddenEdgeColor' ].value = this.tempPulseColor2;
				renderer.setRenderTarget( this.renderTargetEdgeBuffer1 );
				renderer.clear();
				this.fsQuad.render( renderer );

				// 4. Apply Blur on Half res
				this.fsQuad.material = this.separableBlurMaterial1;
				this.separableBlurMaterial1.uniforms[ 'colorTexture' ].value = this.renderTargetEdgeBuffer1.texture;
				this.separableBlurMaterial1.uniforms[ 'direction' ].value = OutlinePass.BlurDirectionX;
				this.separableBlurMaterial1.uniforms[ 'kernelRadius' ].value = this.edgeThickness;
				renderer.setRenderTarget( this.renderTargetBlurBuffer1 );
				renderer.clear();
				this.fsQuad.render( renderer );
				this.separableBlurMaterial1.uniforms[ 'colorTexture' ].value = this.renderTargetBlurBuffer1.texture;
				this.separableBlurMaterial1.uniforms[ 'direction' ].value = OutlinePass.BlurDirectionY;
				renderer.setRenderTarget( this.renderTargetEdgeBuffer1 );
				renderer.clear();
				this.fsQuad.render( renderer );

				// Apply Blur on quarter res
				this.fsQuad.material = this.separableBlurMaterial2;
				this.separableBlurMaterial2.uniforms[ 'colorTexture' ].value = this.renderTargetEdgeBuffer1.texture;
				this.separableBlurMaterial2.uniforms[ 'direction' ].value = OutlinePass.BlurDirectionX;
				renderer.setRenderTarget( this.renderTargetBlurBuffer2 );
				renderer.clear();
				this.fsQuad.render( renderer );
				this.separableBlurMaterial2.uniforms[ 'colorTexture' ].value = this.renderTargetBlurBuffer2.texture;
				this.separableBlurMaterial2.uniforms[ 'direction' ].value = OutlinePass.BlurDirectionY;
				renderer.setRenderTarget( this.renderTargetEdgeBuffer2 );
				renderer.clear();
				this.fsQuad.render( renderer );

				// Blend it additively over the input texture
				this.fsQuad.material = this.overlayMaterial;
				this.overlayMaterial.uniforms[ 'maskTexture' ].value = this.renderTargetMaskBuffer.texture;
				this.overlayMaterial.uniforms[ 'edgeTexture1' ].value = this.renderTargetEdgeBuffer1.texture;
				this.overlayMaterial.uniforms[ 'edgeTexture2' ].value = this.renderTargetEdgeBuffer2.texture;
				this.overlayMaterial.uniforms[ 'patternTexture' ].value = this.patternTexture;
				this.overlayMaterial.uniforms[ 'edgeStrength' ].value = this.edgeStrength;
				this.overlayMaterial.uniforms[ 'edgeGlow' ].value = this.edgeGlow;
				this.overlayMaterial.uniforms[ 'usePatternTexture' ].value = this.usePatternTexture;
				if ( maskActive ) renderer.state.buffers.stencil.setTest( true );
				renderer.setRenderTarget( readBuffer );
				this.fsQuad.render( renderer );
				renderer.setClearColor( this._oldClearColor, this.oldClearAlpha );
				renderer.autoClear = oldAutoClear;

			}

			if ( this.renderToScreen ) {

				this.fsQuad.material = this.materialCopy;
				this.copyUniforms[ 'tDiffuse' ].value = readBuffer.texture;
				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			}

		}
		getPrepareMaskMaterial() {

			return new THREE.ShaderMaterial( {
				uniforms: {
					'depthTexture': {
						value: null
					},
					'cameraNearFar': {
						value: new THREE.Vector2( 0.5, 0.5 )
					},
					'textureMatrix': {
						value: null
					}
				},
				vertexShader: `#include <morphtarget_pars_vertex>
				#include <skinning_pars_vertex>

				varying vec4 projTexCoord;
				varying vec4 vPosition;
				uniform mat4 textureMatrix;

				void main() {

					#include <skinbase_vertex>
					#include <begin_vertex>
					#include <morphtarget_vertex>
					#include <skinning_vertex>
					#include <project_vertex>

					vPosition = mvPosition;

					vec4 worldPosition = vec4( transformed, 1.0 );

					#ifdef USE_INSTANCING

						worldPosition = instanceMatrix * worldPosition;

					#endif
					
					worldPosition = modelMatrix * worldPosition;

					projTexCoord = textureMatrix * worldPosition;

				}`,
				fragmentShader: `#include <packing>
				varying vec4 vPosition;
				varying vec4 projTexCoord;
				uniform sampler2D depthTexture;
				uniform vec2 cameraNearFar;

				void main() {

					float depth = unpackRGBAToDepth(texture2DProj( depthTexture, projTexCoord ));
					float viewZ = - DEPTH_TO_VIEW_Z( depth, cameraNearFar.x, cameraNearFar.y );
					float depthTest = (-vPosition.z > viewZ) ? 1.0 : 0.0;
					gl_FragColor = vec4(0.0, depthTest, 1.0, 1.0);

				}`
			} );

		}
		getEdgeDetectionMaterial() {

			return new THREE.ShaderMaterial( {
				uniforms: {
					'maskTexture': {
						value: null
					},
					'texSize': {
						value: new THREE.Vector2( 0.5, 0.5 )
					},
					'visibleEdgeColor': {
						value: new THREE.Vector3( 1.0, 1.0, 1.0 )
					},
					'hiddenEdgeColor': {
						value: new THREE.Vector3( 1.0, 1.0, 1.0 )
					}
				},
				vertexShader: `varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `varying vec2 vUv;

				uniform sampler2D maskTexture;
				uniform vec2 texSize;
				uniform vec3 visibleEdgeColor;
				uniform vec3 hiddenEdgeColor;

				void main() {
					vec2 invSize = 1.0 / texSize;
					vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);
					vec4 c1 = texture2D( maskTexture, vUv + uvOffset.xy);
					vec4 c2 = texture2D( maskTexture, vUv - uvOffset.xy);
					vec4 c3 = texture2D( maskTexture, vUv + uvOffset.yw);
					vec4 c4 = texture2D( maskTexture, vUv - uvOffset.yw);
					float diff1 = (c1.r - c2.r)*0.5;
					float diff2 = (c3.r - c4.r)*0.5;
					float d = length( vec2(diff1, diff2) );
					float a1 = min(c1.g, c2.g);
					float a2 = min(c3.g, c4.g);
					float visibilityFactor = min(a1, a2);
					vec3 edgeColor = 1.0 - visibilityFactor > 0.001 ? visibleEdgeColor : hiddenEdgeColor;
					gl_FragColor = vec4(edgeColor, 1.0) * vec4(d);
				}`
			} );

		}
		getSeperableBlurMaterial( maxRadius ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'MAX_RADIUS': maxRadius
				},
				uniforms: {
					'colorTexture': {
						value: null
					},
					'texSize': {
						value: new THREE.Vector2( 0.5, 0.5 )
					},
					'direction': {
						value: new THREE.Vector2( 0.5, 0.5 )
					},
					'kernelRadius': {
						value: 1.0
					}
				},
				vertexShader: `varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;
				uniform float kernelRadius;

				float gaussianPdf(in float x, in float sigma) {
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
				}

				void main() {
					vec2 invSize = 1.0 / texSize;
					float sigma = kernelRadius/2.0;
					float weightSum = gaussianPdf(0.0, sigma);
					vec4 diffuseSum = texture2D( colorTexture, vUv) * weightSum;
					vec2 delta = direction * invSize * kernelRadius/float(MAX_RADIUS);
					vec2 uvOffset = delta;
					for( int i = 1; i <= MAX_RADIUS; i ++ ) {
						float x = kernelRadius * float(i) / float(MAX_RADIUS);
						float w = gaussianPdf(x, sigma);
						vec4 sample1 = texture2D( colorTexture, vUv + uvOffset);
						vec4 sample2 = texture2D( colorTexture, vUv - uvOffset);
						diffuseSum += ((sample1 + sample2) * w);
						weightSum += (2.0 * w);
						uvOffset += delta;
					}
					gl_FragColor = diffuseSum/weightSum;
				}`
			} );

		}
		getOverlayMaterial() {

			return new THREE.ShaderMaterial( {
				uniforms: {
					'maskTexture': {
						value: null
					},
					'edgeTexture1': {
						value: null
					},
					'edgeTexture2': {
						value: null
					},
					'patternTexture': {
						value: null
					},
					'edgeStrength': {
						value: 1.0
					},
					'edgeGlow': {
						value: 1.0
					},
					'usePatternTexture': {
						value: 0.0
					}
				},
				vertexShader: `varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `varying vec2 vUv;

				uniform sampler2D maskTexture;
				uniform sampler2D edgeTexture1;
				uniform sampler2D edgeTexture2;
				uniform sampler2D patternTexture;
				uniform float edgeStrength;
				uniform float edgeGlow;
				uniform bool usePatternTexture;

				void main() {
					vec4 edgeValue1 = texture2D(edgeTexture1, vUv);
					vec4 edgeValue2 = texture2D(edgeTexture2, vUv);
					vec4 maskColor = texture2D(maskTexture, vUv);
					vec4 patternColor = texture2D(patternTexture, 6.0 * vUv);
					float visibilityFactor = 1.0 - maskColor.g > 0.0 ? 1.0 : 0.5;
					vec4 edgeValue = edgeValue1 + edgeValue2 * edgeGlow;
					vec4 finalColor = edgeStrength * maskColor.r * edgeValue;
					if(usePatternTexture)
						finalColor += + visibilityFactor * (1.0 - maskColor.r) * (1.0 - patternColor.r);
					gl_FragColor = finalColor;
				}`,
				blending: THREE.AdditiveBlending,
				depthTest: false,
				depthWrite: false,
				transparent: true
			} );

		}

	}
	OutlinePass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
	OutlinePass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

	THREE.OutlinePass = OutlinePass;

} )();
