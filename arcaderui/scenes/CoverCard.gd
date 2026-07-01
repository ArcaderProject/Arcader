extends Control

@onready var cover: TextureRect = $Cover

func _ready() -> void:
	if cover.texture == null:
		cover.texture = UIFactory.make_placeholder()

func set_height(h: float) -> void:
	var w := h * 2.0 / 3.0
	custom_minimum_size = Vector2(w, h)
	size = Vector2(w, h)
	pivot_offset = Vector2(w, h) * 0.5
	var mat := ($Cover as TextureRect).material
	if mat is ShaderMaterial:
		(mat as ShaderMaterial).set_shader_parameter("size_px", Vector2(w, h))
