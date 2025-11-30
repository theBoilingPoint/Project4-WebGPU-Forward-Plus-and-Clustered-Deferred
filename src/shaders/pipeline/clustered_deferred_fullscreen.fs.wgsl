// compute_color.wgsl is concadenated to this shader
@group(1) @binding(0) var posTex: texture_2d<f32>;
@group(1) @binding(1) var norTex: texture_2d<f32>;
@group(1) @binding(2) var albedoTex: texture_2d<f32>;

struct FragmentInput
{
    @builtin(position) fragPos: vec4f
}

@fragment
fn main(in: FragmentInput) -> @location(0) vec4f {
    let pixelPos = vec2<u32>(in.fragPos.xy);

    let diffuseColor = textureLoad(albedoTex, pixelPos, 0);
    if (diffuseColor.a == 0.0) {
        return vec4f(0.0);
    }

    let nor = textureLoad(norTex, pixelPos, 0).xyz;
    let pos = textureLoad(posTex, pixelPos, 0).xyz;

    let finalColor = computeColor(pos, nor, diffuseColor);

    return vec4f(finalColor, 1.0);
}