shader_type canvas_item;

uniform float radius_px = 24.0;
uniform vec2 size_px = vec2(100.0, 150.0);

void fragment() {
	vec2 pos = UV * size_px;
	vec2 half_size = size_px * 0.5;
	vec2 q = abs(pos - half_size) - (half_size - vec2(radius_px));
	float dist = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius_px;
	float aa = max(fwidth(dist), 0.0001);
	float alpha = 1.0 - smoothstep(-aa, aa, dist);
	COLOR.a *= alpha;
}
