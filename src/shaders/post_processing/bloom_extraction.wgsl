// compute_color.wgsl is concadenated to this shader
@group(1) @binding(0) var posTex: texture_2d<f32>;
@group(1) @binding(1) var norTex: texture_2d<f32>;
@group(1) @binding(2) var albedoTex: texture_2d<f32>;

struct FragmentInput
{
    @builtin(position) fragPos: vec4f
}

struct FragmentOutput {
    @location(0) baseColor: vec4<f32>,
    @location(1) extractedColor: vec4<f32>,
}

@fragment
fn main(in: FragmentInput) -> FragmentOutput {
    let pixelPos = vec2<u32>(in.fragPos.xy);

    let diffuseColor = textureLoad(albedoTex, pixelPos, 0);
    if (diffuseColor.a == 0.0) {
        var output: FragmentOutput;
        output.baseColor = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        output.extractedColor = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        return output;
    }

    let nor = textureLoad(norTex, pixelPos, 0).xyz;
    let pos = textureLoad(posTex, pixelPos, 0).xyz;

    let finalColor = computeColor(pos, nor, diffuseColor);

    var output: FragmentOutput;
    output.baseColor = vec4<f32>(finalColor, 1.0);

    // Standard Luma coefficients for better brightness perception
    let brightness = dot(finalColor, vec3(0.2126, 0.7152, 0.0722));
    output.extractedColor = select(
        vec4<f32>(0.0, 0.0, 0.0, 1.0),
        output.baseColor,
        brightness > 0.01 // Threshold
    );

    return output;
}