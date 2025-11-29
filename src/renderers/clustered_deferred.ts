import * as renderer from '../renderer';
import * as shaders from '../shaders/shaders';
import { Stage } from '../stage/stage';

export class ClusteredDeferredRenderer extends renderer.Renderer {
    // TODO-3: add layouts, pipelines, textures, etc. needed for Forward+ here
    // you may need extra uniforms such as the camera view matrix and the canvas resolution
    /** Bind Group Variables **/
    sceneUniformsBindGroupLayout: GPUBindGroupLayout;
    sceneUniformsBindGroup: GPUBindGroup;
    gBufferBindGroupLayout: GPUBindGroupLayout;
    gBufferBindGroup: GPUBindGroup;
    bloomBindGroupLayout: GPUBindGroupLayout;
    bloomBindGroup: GPUBindGroup;
    /***************************************/

    /** Texture Variables **/
    depthTexture: GPUTexture;
    gBufferPositionTexture: GPUTexture;
    gBufferNormalTexture: GPUTexture;
    gBufferAlbedoTexture: GPUTexture;
    fullScreenTexture: GPUTexture;
    bloomExtractionTexture: GPUTexture;
    bloomBlurTexture: GPUTexture;

    depthTextureView: GPUTextureView;
    gBufferPositionTextureView: GPUTextureView;
    gBufferNormalTextureView: GPUTextureView;
    gBufferAlbedoTextureView: GPUTextureView;
    fullScreenTextureView: GPUTextureView;
    bloomExtractionTextureView: GPUTextureView;
    bloomBlurTextureView: GPUTextureView;
    /***************************************/

    /** Pipeline Variables **/
    gBufferPass: GPURenderPipeline; // the pass to populate g buffers
    bloomExtractionPass: GPURenderPipeline; // the pass to render to both a fullscreen texture and a bright pixel texture
    bloomBlurPass: GPURenderPipeline; // the pass to blur the bright pixel texture
    finalPass: GPURenderPipeline; // the pass the combine the fullscreen texture and the blurred bright pixel texture
    /***************************************/

    constructor(stage: Stage) {
        super(stage);

        // TODO-3: initialize layouts, pipelines, textures, etc. needed for Forward+ here
        // you'll need two pipelines: one for the G-buffer pass and one for the fullscreen pass
        /** General Bind Group **/
        this.sceneUniformsBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "scene uniforms bind group layout for forward+",
            entries: [
                // Add an entry for camera uniforms at binding 0, visible to the vertex and compute shader, and of type "uniform"
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" }
                },
                { // lightSet
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                },
                { // clusterSet
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                }
            ]
        });

        this.sceneUniformsBindGroup = renderer.device.createBindGroup({
            label: "scene uniforms bind group for forward+",
            layout: this.sceneUniformsBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.camera.uniformsBuffer }
                }, 
                {
                    binding: 1,
                    resource: { buffer: this.lights.lightSetStorageBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: this.lights.clusterSetStorageBuffer }
                }
            ]
        });
        /***************************************************************************/

        /** Initialise Textures **/
        const gBufferTextureFormat = "rgba16float";
        const canvasWidth = Math.max(1, renderer.canvas.width);
        const canvasHeight = Math.max(1, renderer.canvas.height);

        this.depthTexture = renderer.device.createTexture({
            size: {
                width: canvasWidth,
                height: canvasHeight,
                depthOrArrayLayers: 1
            },
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.gBufferPositionTexture = renderer.device.createTexture({
            size: {
                width: canvasWidth,
                height: canvasHeight,
                depthOrArrayLayers: 1
            },
            format: gBufferTextureFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.gBufferNormalTexture = renderer.device.createTexture({
            size: {
                width: canvasWidth,
                height: canvasHeight,
                depthOrArrayLayers: 1
            },
            format: gBufferTextureFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.gBufferAlbedoTexture = renderer.device.createTexture({
            size: {
                width: canvasWidth,
                height: canvasHeight,
                depthOrArrayLayers: 1
            },
            format: gBufferTextureFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.fullScreenTexture = renderer.device.createTexture({
            size: {
                width: canvasWidth,
                height: canvasHeight,
                depthOrArrayLayers: 1
            },
            format: gBufferTextureFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.bloomExtractionTexture = renderer.device.createTexture({
            size: {
                width: canvasWidth,
                height: canvasHeight,
                depthOrArrayLayers: 1
            },
            format: gBufferTextureFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.bloomBlurTexture = renderer.device.createTexture({
            size: {
                width: canvasWidth,
                height: canvasHeight,
                depthOrArrayLayers: 1
            },
            format: gBufferTextureFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });

        this.depthTextureView = this.depthTexture.createView();
        this.gBufferPositionTextureView = this.gBufferPositionTexture.createView();
        this.gBufferNormalTextureView = this.gBufferNormalTexture.createView();
        this.gBufferAlbedoTextureView = this.gBufferAlbedoTexture.createView();
        this.fullScreenTextureView = this.fullScreenTexture.createView();
        this.bloomExtractionTextureView = this.bloomExtractionTexture.createView();
        this.bloomBlurTextureView = this.bloomBlurTexture.createView();
        /***************************************************************************/

        /** Define G-Buffer Bind Group **/
        this.gBufferBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "G-buffer bind group layout",
            entries: [
                // Position Texture
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d"
                    }
                },
                // Normal Texture
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d"
                    }
                },
                // Albedo Texture
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d"
                    }
                }
            ]
        });
        this.gBufferBindGroup = renderer.device.createBindGroup({
            label: "G-buffer bind group",
            layout: this.gBufferBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.gBufferPositionTextureView
                },
                {
                    binding: 1,
                    resource: this.gBufferNormalTextureView
                },
                {
                    binding: 2,
                    resource: this.gBufferAlbedoTextureView
                }
            ]
        });
        /***************************************************************************/

        /** Define Bloom Bind Group **/
        this.bloomBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "bloom bind group layout",
            entries: [
                // base render (i.e. the final render without bloom)
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d"
                    }
                },
                // blurred extracted bright parts
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d"
                    }
                }
            ]
        });
        this.bloomBindGroup = renderer.device.createBindGroup({
            label: "bloom bind group",
            layout: this.bloomBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.fullScreenTextureView
                },
                {
                    binding: 1,
                    resource: this.bloomBlurTextureView
                }
            ]
        });
        /***************************************************************************/

        /** Define G-Buffer Pass **/
        this.gBufferPass = renderer.device.createRenderPipeline({
            label: "G-buffer pass pipeline",
            layout: renderer.device.createPipelineLayout({
                label: "G-buffer pass pipeline layout",
                bindGroupLayouts: [
                    this.sceneUniformsBindGroupLayout,
                    renderer.modelBindGroupLayout,
                    renderer.materialBindGroupLayout
                ]
            }),
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus"
            },
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "G-buffer pass vert shader",
                    code: shaders.naiveVertSrc
                }),
                buffers: [ renderer.vertexBufferLayout ]
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "G-buffer pass frag shader",
                    code: shaders.clusteredDeferredFragSrc,
                }),
                entryPoint: "main",
                targets: [
                    { format: gBufferTextureFormat },
                    { format: gBufferTextureFormat },
                    { format: gBufferTextureFormat }
                ]
            }
        });
        /***************************************************************************/

        /** Define Bloom Extraction Pass **/
        this.bloomExtractionPass = renderer.device.createRenderPipeline({
            label: "Bloom extraction pass pipeline",
            layout: renderer.device.createPipelineLayout({
                label: "Bloom extraction pass pipeline layout",
                bindGroupLayouts: [
                    this.sceneUniformsBindGroupLayout,
                    this.gBufferBindGroupLayout
                ]
            }),
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "Bloom extraction pass vert shader",
                    code: shaders.clusteredDeferredFullscreenVertSrc
                }),
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "Bloom extraction pass frag shader",
                    code: shaders.clusteredDeferredFullscreenFragSrc,
                }),
                entryPoint: "main",
                targets: [
                    { format: gBufferTextureFormat },
                    { format: gBufferTextureFormat }
                ]
            }
        });
        /***************************************************************************/

        /** Define Final Pass **/
        this.finalPass = renderer.device.createRenderPipeline({
            label: "final pass pipeline",
            layout: renderer.device.createPipelineLayout({
                label: "final pipeline layout",
                bindGroupLayouts: [
                    this.bloomBindGroupLayout
                ]
            }),
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "final pass vert shader",
                    code: shaders.clusteredDeferredFullscreenVertSrc
                }),
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "Final pass frag shader",
                    code: shaders.bloomFragSrc,
                }),
                entryPoint: "main",
                targets: [
                    {
                        format: renderer.canvasFormat,
                    }
                ]
            }
        })
    }

    // Pass submission
    runGBufferPass() {
        // Create G-buffer render pass descriptor
        const gBufferPassDescriptor: GPURenderPassDescriptor = {
            label: "Clustered Deferred G-buffer render pass",
            colorAttachments: [
                {
                    view: this.gBufferPositionTextureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.gBufferNormalTextureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.gBufferAlbedoTextureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };

        const commandEncoder = renderer.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(gBufferPassDescriptor);

        passEncoder.setPipeline(this.gBufferPass);
        passEncoder.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup);

        this.scene.iterate(
            node => {
                passEncoder.setBindGroup(shaders.constants.bindGroup_model, node.modelBindGroup);
            },
            material => {
                passEncoder.setBindGroup(shaders.constants.bindGroup_material, material.materialBindGroup);
            },
            primitive => {
                passEncoder.setVertexBuffer(0, primitive.vertexBuffer);
                passEncoder.setIndexBuffer(primitive.indexBuffer, 'uint32');
                passEncoder.drawIndexed(primitive.numIndices);
            }
        );

        passEncoder.end();
        renderer.device.queue.submit([commandEncoder.finish()]);
    }

    runBloomExtractionPass() {
        const bloomExtractionDescriptor: GPURenderPassDescriptor = {
            label: "Clustered Deferred fullscreen render pass",
            colorAttachments: [
                {
                    view: this.fullScreenTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                },
                {
                    view: this.bloomExtractionTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                }
            ]
        };

        const commandEncoder = renderer.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(bloomExtractionDescriptor);

        passEncoder.setPipeline(this.bloomExtractionPass);
        
        passEncoder.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup);
        passEncoder.setBindGroup(1, this.gBufferBindGroup);

        passEncoder.draw(3);

        passEncoder.end();
        renderer.device.queue.submit([commandEncoder.finish()]);
    }

    runFinalPass() {
        const canvasTextureView = renderer.context.getCurrentTexture().createView();

        const fullScreenPassDescriptor: GPURenderPassDescriptor = {
            label: "Clustered Deferred fullscreen render pass",
            colorAttachments: [
                {
                    view: canvasTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                }
            ]
        };

        const commandEncoder = renderer.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(fullScreenPassDescriptor);

        passEncoder.setPipeline(this.finalPass);
        passEncoder.setBindGroup(0, this.bloomBindGroup);

        passEncoder.draw(3);

        passEncoder.end();
        renderer.device.queue.submit([commandEncoder.finish()]);
    }

    override draw() {
        // TODO-3: run the Forward+ rendering pass:
        // - run the clustering compute shader
        // - run the G-buffer pass, outputting position, albedo, and normals
        // - run the fullscreen pass, which reads from the G-buffer and performs lighting calculations
        this.runGBufferPass();
        this.runBloomExtractionPass();
        this.runFinalPass();
    }
}
