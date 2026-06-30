extends Control

const SEARCH_ICON := preload("res://assets/sprites/search.png")
const GRID_ICON := preload("res://assets/sprites/grid.png")
const CAROUSEL_ICON := preload("res://assets/sprites/carousel.png")
const BACK_ICON := preload("res://assets/sprites/back.png")
const ARROW_LEFT := preload("res://assets/sprites/arrow_left.png")
const ARROW_RIGHT := preload("res://assets/sprites/arrow_right.png")

const PANO_CENTER := Vector2(960, 580)
const PANO_CENTER_H := 600.0
const PANO_SIDE_H := 410.0
const PANO_SIDE_DX := 470.0
const GRID_COLUMNS := 4
const GRID_CARD_H := 300.0
const GRID_PAD := 44

var games: Array = []
var selected_index: int = 0
var view: String = "panorama"
var focus_zone: String = "content"
var header_index: int = 1

var back_btn: Control
var search_btn: Control
var toggle_btn: Control
var arrow_left_btn: Control
var arrow_right_btn: Control
var view_host: Control
var name_label: Label
var loading_label: Label
var error_label: Label

var pano_cards: Array = []

var grid_scroll: ScrollContainer
var grid_cards: Array = []

func _ready() -> void:
	Communicator.games_received.connect(_on_games_received)
	Communicator.games_error.connect(_on_games_error)
	Communicator.game_start_error.connect(_on_game_start_error)
	Communicator.connection_restored.connect(_on_connection_restored)
	CoverCache.cover_ready.connect(_on_cover_ready)

	_build_chrome()
	_show_loading("Loading games...")
	Communicator.get_games()

func _build_chrome() -> void:
	add_child(UIFactory.make_background())

	back_btn = UIFactory.make_icon_button(BACK_ICON, 96.0)
	back_btn.position = Vector2(60, 50)
	add_child(back_btn)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 40)
	header.alignment = BoxContainer.ALIGNMENT_CENTER
	header.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	header.offset_top = 55
	header.offset_left = 480
	header.offset_right = -480
	header.grow_horizontal = Control.GROW_DIRECTION_BOTH
	add_child(header)

	search_btn = UIFactory.make_icon_button(SEARCH_ICON, 96.0)
	_wrap_fixed(header, search_btn)

	var pill := UIFactory.make_pill("Select Game", 44)
	pill.custom_minimum_size = Vector2(540, 96)
	pill.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(pill)

	toggle_btn = UIFactory.make_icon_button(GRID_ICON, 96.0)
	_wrap_fixed(header, toggle_btn)

	arrow_left_btn = UIFactory.make_icon_button(ARROW_LEFT, 96.0)
	arrow_left_btn.position = Vector2(110, PANO_CENTER.y - 48)
	add_child(arrow_left_btn)
	arrow_right_btn = UIFactory.make_icon_button(ARROW_RIGHT, 96.0)
	arrow_right_btn.position = Vector2(1714, PANO_CENTER.y - 48)
	add_child(arrow_right_btn)

	view_host = Control.new()
	view_host.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	view_host.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(view_host)

	name_label = Label.new()
	name_label.add_theme_font_size_override("font_size", 48)
	name_label.add_theme_color_override("font_color", UIFactory.RED)
	name_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	name_label.add_theme_constant_override("shadow_offset_x", 3)
	name_label.add_theme_constant_override("shadow_offset_y", 3)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_label.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	name_label.offset_top = 930
	add_child(name_label)

	loading_label = _make_status_label()
	error_label = _make_status_label()
	error_label.add_theme_color_override("font_color", UIFactory.RED_GLOW)

func _wrap_fixed(parent: Control, btn: Control) -> void:
	var holder := Control.new()
	holder.custom_minimum_size = Vector2(96, 96)
	holder.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	btn.position = Vector2(0, 0)
	holder.add_child(btn)
	parent.add_child(holder)

func _make_status_label() -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", 36)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	l.grow_horizontal = Control.GROW_DIRECTION_BOTH
	l.grow_vertical = Control.GROW_DIRECTION_BOTH
	l.visible = false
	add_child(l)
	return l

func _show_loading(text: String) -> void:
	loading_label.text = text
	loading_label.visible = true
	error_label.visible = false

func _on_games_received(received: Array) -> void:
	games = received
	selected_index = 0
	loading_label.visible = false
	error_label.visible = false

	if games.is_empty():
		_show_loading("No games found")
		return

	for game in games:
		CoverCache.request_cover(_game_id(game))

	if view == "panorama":
		_build_panorama()
	else:
		_build_grid()
	_update_focus()

func _on_games_error(error: String) -> void:
	loading_label.visible = false
	error_label.text = "Error: " + error
	error_label.visible = true

func _on_game_start_error(error: String) -> void:
	error_label.text = "Error starting game: " + error
	error_label.visible = true

func _on_connection_restored() -> void:
	_show_loading("Loading games...")
	Communicator.get_games()

func _on_cover_ready(game_id: String, texture: Texture2D) -> void:
	if view == "grid":
		for i in range(games.size()):
			if _game_id(games[i]) == game_id and i < grid_cards.size():
				_set_card_cover(grid_cards[i], texture)
	else:
		_refresh_panorama()

func _game_id(game: Dictionary) -> String:
	return str(game.get("id", ""))

func _game_name(game: Dictionary) -> String:
	return str(game.get("name", "Unknown Game"))

func _clear_view() -> void:
	for c in view_host.get_children():
		c.queue_free()
	pano_cards.clear()
	grid_cards.clear()
	grid_scroll = null

func _build_panorama() -> void:
	_clear_view()
	name_label.visible = true
	arrow_left_btn.visible = true
	arrow_right_btn.visible = true

	for i in range(3):
		var card := UIFactory.make_cover_card(PANO_SIDE_H)
		view_host.add_child(card)
		pano_cards.append(card)
	_refresh_panorama()

func _refresh_panorama() -> void:
	if pano_cards.size() != 3 or games.is_empty():
		return
	var n := games.size()
	var indices := [
		(selected_index - 1 + n) % n,
		selected_index,
		(selected_index + 1) % n,
	]
	var heights := [PANO_SIDE_H, PANO_CENTER_H, PANO_SIDE_H]
	var centers := [
		PANO_CENTER + Vector2(-PANO_SIDE_DX, 0),
		PANO_CENTER,
		PANO_CENTER + Vector2(PANO_SIDE_DX, 0),
	]
	for slot in range(3):
		var card: Control = pano_cards[slot]
		var game: Dictionary = games[indices[slot]]
		UIFactory.set_card_size(card, heights[slot])
		card.position = (centers[slot] - card.size * 0.5).round()
		card.z_index = 10 if slot == 1 else 1
		card.modulate = Color.WHITE if slot == 1 else Color(0.78, 0.78, 0.82)
		var tex: Texture2D = CoverCache.get_texture(_game_id(game))
		_set_card_cover(card, tex if tex else UIFactory.make_placeholder())
		UIFactory.set_card_selected(card, slot == 1, UIFactory.RED_GLOW)

	name_label.text = _game_name(games[selected_index])

func _build_grid() -> void:
	_clear_view()
	name_label.visible = false
	arrow_left_btn.visible = false
	arrow_right_btn.visible = false

	grid_scroll = ScrollContainer.new()
	grid_scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	grid_scroll.offset_top = 220
	grid_scroll.offset_bottom = -40
	grid_scroll.offset_left = 120
	grid_scroll.offset_right = -120
	grid_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	view_host.add_child(grid_scroll)

	var pad := MarginContainer.new()
	pad.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pad.add_theme_constant_override("margin_left", GRID_PAD)
	pad.add_theme_constant_override("margin_right", GRID_PAD)
	pad.add_theme_constant_override("margin_top", GRID_PAD)
	pad.add_theme_constant_override("margin_bottom", GRID_PAD)
	grid_scroll.add_child(pad)

	var grid := GridContainer.new()
	grid.columns = GRID_COLUMNS
	grid.add_theme_constant_override("h_separation", 60)
	grid.add_theme_constant_override("v_separation", 50)
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pad.add_child(grid)

	grid_cards.clear()
	for game in games:
		var cell := VBoxContainer.new()
		cell.add_theme_constant_override("separation", 14)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL

		var card_holder := CenterContainer.new()
		var card := UIFactory.make_cover_card(GRID_CARD_H)
		var tex: Texture2D = CoverCache.get_texture(_game_id(game))
		if tex:
			_set_card_cover(card, tex)
		card_holder.add_child(card)
		cell.add_child(card_holder)

		var label := Label.new()
		label.text = _game_name(game)
		label.add_theme_font_size_override("font_size", 24)
		label.add_theme_color_override("font_color", Color.WHITE)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size = Vector2(GRID_CARD_H * 2.0 / 3.0, 0)
		cell.add_child(label)

		grid.add_child(cell)
		grid_cards.append(card)
	_update_grid_selection()

func _update_grid_selection() -> void:
	for i in range(grid_cards.size()):
		var card: Control = grid_cards[i]
		var sel := i == selected_index and focus_zone == "content"
		card.scale = Vector2(1.08, 1.08) if sel else Vector2.ONE
		card.z_index = 5 if sel else 0
		UIFactory.set_card_selected(card, sel, UIFactory.RED_GLOW)
	_scroll_to_selected()

func _scroll_to_selected() -> void:
	if not is_inside_tree() or not grid_scroll or selected_index >= grid_cards.size():
		return
	var card: Control = grid_cards[selected_index]
	await get_tree().process_frame
	if not is_inside_tree() or not grid_scroll:
		return
	var cell := card.get_parent().get_parent() as Control
	if not cell:
		return
	var top := cell.global_position.y - grid_scroll.global_position.y + grid_scroll.scroll_vertical
	var bottom := top + cell.size.y
	var view_top := grid_scroll.scroll_vertical
	var view_bottom := view_top + grid_scroll.size.y
	if bottom > view_bottom:
		grid_scroll.scroll_vertical = int(bottom - grid_scroll.size.y + GRID_PAD)
	elif top < view_top:
		grid_scroll.scroll_vertical = int(maxf(0.0, top - GRID_PAD))

func _set_card_cover(card: Control, texture: Texture2D) -> void:
	var cover := card.get_node_or_null("Cover") as TextureRect
	if cover and texture:
		cover.texture = texture

func _unhandled_input(event: InputEvent) -> void:
	if games.is_empty():
		return
	if event.is_action_pressed("ui_cancel"):
		ScreenManager.change_to_main_menu()
		return
	if focus_zone == "header":
		_input_header(event)
	elif view == "panorama":
		_input_panorama(event)
	else:
		_input_grid(event)

func _input_header(event: InputEvent) -> void:
	if event.is_action_pressed("ui_left"):
		header_index = maxi(0, header_index - 1)
		_update_focus()
	elif event.is_action_pressed("ui_right"):
		header_index = mini(2, header_index + 1)
		_update_focus()
	elif event.is_action_pressed("ui_down"):
		focus_zone = "content"
		_update_focus()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_activate_header()

func _input_panorama(event: InputEvent) -> void:
	if event.is_action_pressed("ui_left"):
		selected_index = (selected_index - 1 + games.size()) % games.size()
		_refresh_panorama()
		_pulse(pano_cards[1])
	elif event.is_action_pressed("ui_right"):
		selected_index = (selected_index + 1) % games.size()
		_refresh_panorama()
		_pulse(pano_cards[1])
	elif event.is_action_pressed("ui_up"):
		focus_zone = "header"
		header_index = 1
		_update_focus()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_start_selected()

func _input_grid(event: InputEvent) -> void:
	var col := selected_index % GRID_COLUMNS
	if event.is_action_pressed("ui_left"):
		if col > 0:
			selected_index -= 1
			_update_grid_selection()
	elif event.is_action_pressed("ui_right"):
		if col < GRID_COLUMNS - 1 and selected_index < games.size() - 1:
			selected_index += 1
			_update_grid_selection()
	elif event.is_action_pressed("ui_down"):
		if selected_index + GRID_COLUMNS < games.size():
			selected_index += GRID_COLUMNS
			_update_grid_selection()
	elif event.is_action_pressed("ui_up"):
		if selected_index - GRID_COLUMNS >= 0:
			selected_index -= GRID_COLUMNS
			_update_grid_selection()
		else:
			focus_zone = "header"
			header_index = 1
			_update_focus()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_start_selected()

func _activate_header() -> void:
	match header_index:
		0:
			ScreenManager.change_to_main_menu()
		1:
			ScreenManager.change_to_search()
		2:
			_toggle_view()

func _toggle_view() -> void:
	if view == "panorama":
		view = "grid"
		toggle_btn.get_node("Icon").texture = CAROUSEL_ICON
		_build_grid()
	else:
		view = "panorama"
		toggle_btn.get_node("Icon").texture = GRID_ICON
		_build_panorama()
	_update_focus()

func _start_selected() -> void:
	if selected_index < games.size():
		var game_id := _game_id(games[selected_index])
		if game_id != "":
			Communicator.start_game(game_id)

func _pulse(card: Control) -> void:
	if not is_instance_valid(card):
		return
	var t := create_tween()
	t.tween_property(card, "scale", Vector2(1.05, 1.05), 0.08)
	t.tween_property(card, "scale", Vector2.ONE, 0.10)

func _update_focus() -> void:
	UIFactory.set_icon_selected(back_btn, focus_zone == "header" and header_index == 0)
	UIFactory.set_icon_selected(search_btn, focus_zone == "header" and header_index == 1)
	UIFactory.set_icon_selected(toggle_btn, focus_zone == "header" and header_index == 2)
	if view == "panorama":
		_refresh_panorama()
	else:
		_update_grid_selection()
