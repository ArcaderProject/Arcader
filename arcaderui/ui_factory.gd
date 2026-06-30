class_name UIFactory
extends Object

const ICON_BTN_TEX := preload("res://assets/sprites/icon_btn.png")
const KEY_BTN_TEX := preload("res://assets/sprites/key_btn.png")
const BUTTON_TEX := preload("res://assets/sprites/button.png")
const BUTTON_NINE_TEX := preload("res://assets/sprites/button_nine.png")
const PILL_H := 96.0
const BACKGROUND_TEX := preload("res://assets/sprites/background.png")
const ROUNDED_SHADER := preload("res://assets/rounded.gdshader")

const RED := Color("#a91515")
const RED_GLOW := Color("#ff2a2a")

static func make_background() -> TextureRect:
	var bg := TextureRect.new()
	bg.texture = BACKGROUND_TEX
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg.z_index = -100
	return bg

static func make_icon_button(icon_tex: Texture2D, diameter: float, icon_scale: float = 0.5) -> Control:
	var root := Control.new()
	root.custom_minimum_size = Vector2(diameter, diameter)
	root.size = Vector2(diameter, diameter)
	root.pivot_offset = Vector2(diameter, diameter) * 0.5
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var glow := Panel.new()
	glow.name = "Glow"
	glow.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	glow.visible = false
	var gstyle := StyleBoxFlat.new()
	gstyle.bg_color = Color(0, 0, 0, 0)
	gstyle.set_corner_radius_all(int(diameter))
	gstyle.shadow_color = Color(RED_GLOW.r, RED_GLOW.g, RED_GLOW.b, 0.85)
	gstyle.shadow_size = 26
	glow.add_theme_stylebox_override("panel", gstyle)
	root.add_child(glow)

	var bg := TextureRect.new()
	bg.name = "Bg"
	bg.texture = ICON_BTN_TEX
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(bg)

	var icon := TextureRect.new()
	icon.name = "Icon"
	icon.texture = icon_tex
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	var pad := diameter * (1.0 - icon_scale) * 0.5
	icon.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	icon.offset_left = pad
	icon.offset_top = pad
	icon.offset_right = -pad
	icon.offset_bottom = -pad
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(icon)
	return root

static func make_pill(text: String, font_size: int = 40) -> Control:
	var np := NinePatchRect.new()
	np.name = "Pill"
	np.texture = BUTTON_NINE_TEX
	np.patch_margin_left = 48
	np.patch_margin_right = 48
	np.patch_margin_top = 0
	np.patch_margin_bottom = 0
	np.custom_minimum_size = Vector2(360, PILL_H)
	np.size_flags_vertical = Control.SIZE_SHRINK_CENTER

	var label := Label.new()
	label.name = "Label"
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", Color.BLACK)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	label.offset_bottom = -6
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	np.add_child(label)
	return np

static func make_cover_card(height: float) -> Control:
	var width := height * 2.0 / 3.0
	var root := Control.new()
	root.custom_minimum_size = Vector2(width, height)
	root.size = Vector2(width, height)
	root.pivot_offset = Vector2(width, height) * 0.5
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var glow := Panel.new()
	glow.name = "Glow"
	glow.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	glow.offset_left = -6
	glow.offset_top = -6
	glow.offset_right = 6
	glow.offset_bottom = 6
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	glow.visible = false
	root.add_child(glow)

	var cover := TextureRect.new()
	cover.name = "Cover"
	cover.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	cover.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	cover.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cover.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cover.texture = make_placeholder()

	var mat := ShaderMaterial.new()
	mat.shader = ROUNDED_SHADER
	mat.set_shader_parameter("radius_px", 18.0)
	mat.set_shader_parameter("size_px", Vector2(width, height))
	cover.material = mat
	root.add_child(cover)
	return root

static func set_card_size(card: Control, height: float) -> void:
	var width := height * 2.0 / 3.0
	card.custom_minimum_size = Vector2(width, height)
	card.size = Vector2(width, height)
	card.pivot_offset = Vector2(width, height) * 0.5
	var cover := card.get_node_or_null("Cover") as TextureRect
	if cover and cover.material is ShaderMaterial:
		(cover.material as ShaderMaterial).set_shader_parameter("size_px", Vector2(width, height))

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
