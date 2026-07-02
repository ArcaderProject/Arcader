extends Control

const GRID_ICON := preload("res://assets/sprites/grid.png")
const CAROUSEL_ICON := preload("res://assets/sprites/carousel.png")
const COVER_CARD := preload("res://scenes/CoverCard.tscn")

const PANO_CENTER := Vector2(960, 580)
const PANO_CARD_H := 600.0
const PANO_SPACING := 470.0
const PANO_EASE := 13.0
const GRID_COLUMNS := 4
const GRID_CARD_H := 300.0
const GRID_PAD := 44

var games: Array = []
var selected_index: int = 0
var view: String = "panorama"
var focus_zone: String = "content"
var header_index: int = 1

@onready var back_btn: Control = $BackBtn
@onready var search_btn: Control = $Header/SearchHolder/SearchBtn
@onready var toggle_btn: Control = $Header/ToggleHolder/ToggleBtn
@onready var arrow_left_btn: Control = $ArrowLeft
@onready var arrow_right_btn: Control = $ArrowRight
@onready var view_host: Control = $ViewHost
@onready var name_label: Label = $NameLabel
@onready var loading_label: Label = $LoadingLabel
@onready var error_label: Label = $ErrorLabel

var pano_cards: Array = []
var pano_scroll: float = 0.0
var pano_target: float = 0.0

var grid_scroll: ScrollContainer
var grid_cards: Array = []

var _repeat := NavRepeat.new()
var _placeholder: Texture2D = UIFactory.make_placeholder()

func _ready() -> void:
	Communicator.games_received.connect(_on_games_received)
	Communicator.games_error.connect(_on_games_error)
	Communicator.game_start_error.connect(_on_game_start_error)
	Communicator.connection_restored.connect(_on_connection_restored)
	Communicator.games_changed.connect(_on_games_changed)
	CoverCache.cover_ready.connect(_on_cover_ready)

	_show_loading("Loading games...")
	Communicator.get_games()

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

func _on_games_changed() -> void:
	Communicator.get_games()

func _on_cover_ready(game_id: String, texture: Texture2D) -> void:
	if view == "grid":
		for i in range(games.size()):
			if _game_id(games[i]) == game_id and i < grid_cards.size():
				_set_card_cover(grid_cards[i], texture)
	else:
		for card in pano_cards:
			var gi := int(card.get_meta("gi", -1))
			if gi >= 0 and gi < games.size() and _game_id(games[gi]) == game_id:
				_set_card_cover(card, texture)

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

	pano_scroll = float(selected_index)
	pano_target = float(selected_index)
	for i in range(5):
		var card: Control = COVER_CARD.instantiate()
		card.set_height(PANO_CARD_H)
		UIFactory.set_card_selected(card, true, UIFactory.RED_GLOW)
		card.get_node("Glow").visible = false
		card.set_meta("gi", -999)
		view_host.add_child(card)
		pano_cards.append(card)
	_layout_carousel()

func _layout_carousel() -> void:
	if pano_cards.size() != 5 or games.is_empty():
		return
	var n := games.size()
	var base := int(round(pano_scroll))
	var base_size := Vector2(PANO_CARD_H * 2.0 / 3.0, PANO_CARD_H)
	for k in range(5):
		var p := base - 2 + k
		var gi := ((p % n) + n) % n
		var card: Control = pano_cards[k]
		if int(card.get_meta("gi")) != gi:
			card.set_meta("gi", gi)
			var tex: Texture2D = CoverCache.get_texture(_game_id(games[gi]))
			_set_card_cover(card, tex if tex else _placeholder)
		var d := float(p) - pano_scroll
		var ad := absf(d)
		var sc := clampf(1.0 - 0.34 * ad, 0.30, 1.0)
		var alpha := clampf(1.0 - (ad - 1.3) * 1.4, 0.0, 1.0)
		var bright := lerpf(1.0, 0.78, clampf(ad, 0.0, 1.0))
		var cx := PANO_CENTER.x + d * PANO_SPACING
		card.scale = Vector2(sc, sc)
		card.position = (Vector2(cx, PANO_CENTER.y) - base_size * 0.5).round()
		card.modulate = Color(bright, bright, bright, alpha)
		card.z_index = int(round(200.0 - ad * 20.0))
		(card.get_node("Glow") as Panel).visible = ad < 0.5
	name_label.text = _game_name(games[((base % n) + n) % n])

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
		var card: Control = COVER_CARD.instantiate()
		card.set_height(GRID_CARD_H)
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

func _process(delta: float) -> void:
	if games.is_empty():
		return
	var action := _repeat.poll(delta)
	if action != "":
		_move(action)
	if view == "panorama" and pano_cards.size() == 5 and absf(pano_target - pano_scroll) > 0.0005:
		pano_scroll = lerpf(pano_scroll, pano_target, 1.0 - exp(-delta * PANO_EASE))
		if absf(pano_target - pano_scroll) <= 0.0005:
			pano_scroll = pano_target
		_layout_carousel()

func _unhandled_input(event: InputEvent) -> void:
	if games.is_empty():
		return
	if event.is_action_pressed("ui_cancel"):
		ScreenManager.change_to_main_menu()
		return
	if event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		if focus_zone == "header":
			_activate_header()
		else:
			_start_selected()
		return
	for action in NavRepeat.ACTIONS:
		if event.is_action_pressed(action):
			_move(action)
			return

func _move(action: String) -> void:
	if focus_zone == "header":
		_move_header(action)
	elif view == "panorama":
		_move_panorama(action)
	else:
		_move_grid(action)

func _move_header(action: String) -> void:
	match action:
		"ui_left":
			header_index = maxi(0, header_index - 1)
			_update_focus()
		"ui_right":
			header_index = mini(2, header_index + 1)
			_update_focus()
		"ui_down":
			focus_zone = "content"
			_update_focus()

func _move_panorama(action: String) -> void:
	match action:
		"ui_left":
			selected_index = (selected_index - 1 + games.size()) % games.size()
			pano_target -= 1.0
		"ui_right":
			selected_index = (selected_index + 1) % games.size()
			pano_target += 1.0
		"ui_up":
			focus_zone = "header"
			header_index = 1
			_update_focus()

func _move_grid(action: String) -> void:
	var col := selected_index % GRID_COLUMNS
	match action:
		"ui_left":
			if col > 0:
				selected_index -= 1
				_update_grid_selection()
		"ui_right":
			if col < GRID_COLUMNS - 1 and selected_index < games.size() - 1:
				selected_index += 1
				_update_grid_selection()
		"ui_down":
			if selected_index + GRID_COLUMNS < games.size():
				selected_index += GRID_COLUMNS
				_update_grid_selection()
		"ui_up":
			if selected_index - GRID_COLUMNS >= 0:
				selected_index -= GRID_COLUMNS
				_update_grid_selection()
			else:
				focus_zone = "header"
				header_index = 1
				_update_focus()

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

func _update_focus() -> void:
	UIFactory.set_icon_selected(back_btn, focus_zone == "header" and header_index == 0)
	UIFactory.set_icon_selected(search_btn, focus_zone == "header" and header_index == 1)
	UIFactory.set_icon_selected(toggle_btn, focus_zone == "header" and header_index == 2)
	if view == "panorama":
		_layout_carousel()
	else:
		_update_grid_selection()
