extends Control

const COVER_CARD := preload("res://scenes/CoverCard.tscn")
const LETTERS := "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
const KB_COLS := 6
const GRID_COLUMNS := 4
const GRID_CARD_H := 250.0
const GRID_PAD := 44

var query: String = ""
var filtered: Array = []
var games: Array = []

var zone: String = "keyboard"
var key_sel: int = 0
var grid_sel: int = 0

@onready var search_label: Label = $SearchLabel
@onready var grid_scroll: ScrollContainer = $GridScroll
@onready var grid_container: GridContainer = $GridScroll/Pad/Grid
@onready var space_node: Control = $Space
@onready var back_node: Control = $Back
var key_nodes: Array = []
var grid_cards: Array = []
var caret_on: bool = true

var _repeat := NavRepeat.new()

func _ready() -> void:
	Communicator.games_received.connect(_on_games_received)
	Communicator.game_start_error.connect(func(e): _flash_error("Error: " + e))
	Communicator.games_changed.connect(func(): Communicator.get_games())
	CoverCache.cover_ready.connect(_on_cover_ready)

	key_nodes = $Keys.get_children()

	var caret := Timer.new()
	caret.wait_time = 0.5
	caret.timeout.connect(_blink)
	add_child(caret)
	caret.start()

	_update_search_label()
	_update_keyboard_visuals()
	Communicator.get_games()

func _on_games_received(received: Array) -> void:
	games = received
	for game in games:
		CoverCache.request_cover(str(game.get("id", "")))
	_apply_filter()

func _apply_filter() -> void:
	filtered.clear()
	var q := query.to_lower()
	for game in games:
		if q == "" or str(game.get("name", "")).to_lower().contains(q):
			filtered.append(game)
	grid_sel = clampi(grid_sel, 0, maxi(0, filtered.size() - 1))
	_build_grid()

func _build_grid() -> void:
	for c in grid_container.get_children():
		c.queue_free()
	grid_cards.clear()

	for game in filtered:
		var cell := VBoxContainer.new()
		cell.add_theme_constant_override("separation", 10)

		var holder := CenterContainer.new()
		var card: Control = COVER_CARD.instantiate()
		card.set_height(GRID_CARD_H)
		var tex: Texture2D = CoverCache.get_texture(str(game.get("id", "")))
		if tex:
			(card.get_node("Cover") as TextureRect).texture = tex
		holder.add_child(card)
		cell.add_child(holder)

		var label := Label.new()
		label.text = str(game.get("name", ""))
		label.add_theme_font_size_override("font_size", 22)
		label.add_theme_color_override("font_color", Color.WHITE)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size = Vector2(GRID_CARD_H * 2.0 / 3.0, 0)
		cell.add_child(label)

		grid_container.add_child(cell)
		grid_cards.append(card)
	_update_grid_visuals()

func _on_cover_ready(game_id: String, texture: Texture2D) -> void:
	for i in range(filtered.size()):
		if str(filtered[i].get("id", "")) == game_id and i < grid_cards.size():
			(grid_cards[i].get_node("Cover") as TextureRect).texture = texture

func _update_search_label() -> void:
	if query == "":
		search_label.text = " Search"
		search_label.modulate = Color(1, 1, 1, 0.55)
	else:
		search_label.modulate = Color.WHITE
		search_label.text = " " + query + ("_" if caret_on else " ")

func _blink() -> void:
	caret_on = not caret_on
	_update_search_label()

func _update_keyboard_visuals() -> void:
	for i in range(key_nodes.size()):
		_set_key_selected(key_nodes[i], zone == "keyboard" and key_sel == i)
	_set_key_selected(space_node, zone == "keyboard" and key_sel == -2)
	_set_key_selected(back_node, zone == "keyboard" and key_sel == -1)

func _set_key_selected(key: Control, selected: bool) -> void:
	var border := key.get_node_or_null("Border") as Panel
	if border:
		border.visible = selected
	var wide := key == space_node or key == back_node
	key.scale = Vector2(1.12, 1.12) if selected and not wide else Vector2.ONE
	key.modulate = Color(1.3, 1.3, 1.3) if selected else Color.WHITE

func _update_grid_visuals() -> void:
	for i in range(grid_cards.size()):
		var sel := zone == "grid" and i == grid_sel
		var card: Control = grid_cards[i]
		card.scale = Vector2(1.08, 1.08) if sel else Vector2.ONE
		card.z_index = 5 if sel else 0
		UIFactory.set_card_selected(card, sel, UIFactory.RED_GLOW)
	_scroll_to_grid_sel()

func _scroll_to_grid_sel() -> void:
	if not is_inside_tree() or not grid_scroll or grid_sel >= grid_cards.size():
		return
	await get_tree().process_frame
	if not is_inside_tree() or not grid_scroll:
		return
	var cell := grid_cards[grid_sel].get_parent().get_parent() as Control
	if not cell:
		return
	var top := cell.global_position.y - grid_scroll.global_position.y + grid_scroll.scroll_vertical
	var bottom := top + cell.size.y
	if bottom > grid_scroll.scroll_vertical + grid_scroll.size.y:
		grid_scroll.scroll_vertical = int(bottom - grid_scroll.size.y + GRID_PAD)
	elif top < grid_scroll.scroll_vertical:
		grid_scroll.scroll_vertical = int(maxf(0.0, top - GRID_PAD))

func _flash_error(text: String) -> void:
	search_label.text = text

func _process(delta: float) -> void:
	var action := _repeat.poll(delta)
	if action != "":
		_move(action)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		ScreenManager.change_to_games_list()
		return
	if event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_accept()
		return
	for action in NavRepeat.ACTIONS:
		if event.is_action_pressed(action):
			_move(action)
			return

func _accept() -> void:
	if zone == "keyboard":
		_press_key()
	elif not filtered.is_empty():
		var game_id := str(filtered[grid_sel].get("id", ""))
		if game_id != "":
			Communicator.start_game(game_id)

func _move(action: String) -> void:
	if zone == "keyboard":
		_move_keyboard(action)
	else:
		_move_grid(action)

func _move_keyboard(action: String) -> void:
	if key_sel < 0:
		_move_special(action)
		return
	var col := key_sel % KB_COLS
	var row := int(key_sel / KB_COLS)
	match action:
		"ui_left":
			if col > 0:
				key_sel -= 1
				_update_keyboard_visuals()
		"ui_right":
			if col < KB_COLS - 1:
				key_sel += 1
				_update_keyboard_visuals()
			elif not filtered.is_empty():
				zone = "grid"
				_refresh_zones()
		"ui_up":
			if row == 0:
				key_sel = -2 if col < 3 else -1
			else:
				key_sel -= KB_COLS
			_update_keyboard_visuals()
		"ui_down":
			if key_sel + KB_COLS < LETTERS.length():
				key_sel += KB_COLS
				_update_keyboard_visuals()

func _move_special(action: String) -> void:
	match action:
		"ui_left":
			key_sel = -2
			_update_keyboard_visuals()
		"ui_right":
			key_sel = -1
			_update_keyboard_visuals()
		"ui_down":
			key_sel = 0 if key_sel == -2 else 3
			_update_keyboard_visuals()
		"ui_up":
			ScreenManager.change_to_games_list()

func _move_grid(action: String) -> void:
	if filtered.is_empty():
		zone = "keyboard"
		_refresh_zones()
		return
	var col := grid_sel % GRID_COLUMNS
	match action:
		"ui_left":
			if col > 0:
				grid_sel -= 1
				_update_grid_visuals()
			else:
				zone = "keyboard"
				key_sel = 5
				_refresh_zones()
		"ui_right":
			if col < GRID_COLUMNS - 1 and grid_sel < filtered.size() - 1:
				grid_sel += 1
				_update_grid_visuals()
		"ui_down":
			if grid_sel + GRID_COLUMNS < filtered.size():
				grid_sel += GRID_COLUMNS
				_update_grid_visuals()
		"ui_up":
			if grid_sel - GRID_COLUMNS >= 0:
				grid_sel -= GRID_COLUMNS
				_update_grid_visuals()

func _refresh_zones() -> void:
	_update_keyboard_visuals()
	_update_grid_visuals()

func _press_key() -> void:
	if key_sel == -2:
		query += " "
	elif key_sel == -1:
		query = query.substr(0, maxi(0, query.length() - 1))
	else:
		query += LETTERS[key_sel].to_lower()
	caret_on = true
	_update_search_label()
	_apply_filter()
