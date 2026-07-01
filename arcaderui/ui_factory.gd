class_name UIFactory
extends Object

const RED := Color("#a91515")
const RED_GLOW := Color("#ff2a2a")

static func set_card_selected(card: Control, selected: bool, glow_color: Color) -> void:
	var glow := card.get_node_or_null("Glow") as Panel
	if not glow:
		return
	glow.visible = selected
	if not selected:
		return
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0)
	style.set_border_width_all(4)
	style.border_color = glow_color
	style.set_corner_radius_all(22)
	style.shadow_color = Color(glow_color.r, glow_color.g, glow_color.b, 0.65)
	style.shadow_size = 30
	glow.add_theme_stylebox_override("panel", style)

static func set_icon_selected(root: Control, selected: bool) -> void:
	var glow := root.get_node_or_null("Glow") as Panel
	if glow:
		glow.visible = selected
	var target := 1.14 if selected else 1.0
	root.scale = Vector2(target, target)
	root.modulate = Color(1.25, 1.25, 1.25) if selected else Color.WHITE

static func make_placeholder() -> ImageTexture:
	var image := Image.create(120, 180, false, Image.FORMAT_RGB8)
	image.fill(Color(0.12, 0.12, 0.16))
	return ImageTexture.create_from_image(image)
