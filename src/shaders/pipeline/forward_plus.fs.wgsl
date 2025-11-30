// compute_color.wgsl is concadenated to this shader
@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseTexSampler: sampler;

// ------------------------------------
// Shading process:
// ------------------------------------
// Determine which cluster contains the current fragment.
// Retrieve the number of lights that affect the current fragment from the cluster’s data.
// Initialize a variable to accumulate the total light contribution for the fragment.
// For each light in the cluster:
//     Access the light's properties using its index.
//     Calculate the contribution of the light based on its position, the fragment’s position, and the surface normal.
//     Add the calculated contribution to the total light accumulation.
// Multiply the fragment’s diffuse color by the accumulated light contribution.
// Return the final color, ensuring that the alpha component is set appropriately (typically to 1).
struct FragmentInput
{
    @location(0) pos: vec3f,
    @location(1) nor: vec3f,
    // We are using naive vs. So although we are not using the two variables below we need to keep the struct the same.
    @location(2) uv: vec2f,
    @location(3) pos_view: vec3f
}

@fragment
fn main(in: FragmentInput, @builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    let diffuseColor = textureSample(diffuseTex, diffuseTexSampler, in.uv);
    if (diffuseColor.a == 0.0) {
        return vec4f(0.0);
    }

    let finalColor = computeColor(in.pos, in.nor, diffuseColor);
    return vec4(finalColor, 1.0);
}