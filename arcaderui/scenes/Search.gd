extends Control

const KEY_BTN_TEX := preload("res://assets/sprites/key_btn.png")
const KEY_SPACE_TEX := preload("res://assets/sprites/key_space.png")
const KEY_BACK_TEX := preload("res://assets/sprites/key_back.png")

const LETTERS := "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
const KB_COLS := 6
const KEY_SIZE := 84.0
const KEY_GAP := 14.0
const GRID_COLUMNS := 4
const GRID_CARD_H := 250.0
const GRID_PAD := 44

var query: String = ""
var filtered: Array = []
var games: Array = []

var zone: String = "keyboard"
var key_sel: int = 0
var grid_sel: int = 0

var search_label: Label
var key_nodes: Array = []
var space_node: Control
var back_node: Control
var grid_scroll: ScrollContainer
var grid_container: GridContainer
var grid_cards: Array = []
var caret_on: bool = true

var _repeat := NavRepeat.new()

func _ready() -> void:
	Communicator.games_received.connect(_on_games_received)
	Communicator.game_start_error.connect(func(e): _flash_error("Error: " + e))
	CoverCache.cover_ready.connect(_on_cover_ready)

	_build_chrome()

	var caret := Timer.new()
	caret.wait_time = 0.5
	caret.timeout.connect(_blink)
	add_child(caret)
	caret.start()

	Communicator.get_games()

func _build_chrome() -> void:
	add_child(UIFactory.make_background())

	_build_keyboard()

	var bar := Panel.new()
	bar.position = Vector2(720, 50)
	bar.size = Vector2(1130, 80)
	var bar_style := StyleBoxFlat.new()
	bar_style.bg_color = UIFactory.RED
	bar_style.set_corner_radius_all(6)
	bar.add_theme_stylebox_override("panel", bar_style)
	add_child(bar)

	search_label = Label.new()
	search_label.add_theme_font_size_override("font_size", 40)
	search_label.add_theme_color_override("font_color", Color.BLACK)
	search_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	search_label.position = Vector2(745, 50)
	search_label.size = Vector2(1090, 80)
	add_child(search_label)

	grid_scroll = ScrollContainer.new()
	grid_scroll.position = Vector2(700, 170)
	grid_scroll.size = Vector2(1170, 860)
	grid_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(grid_scroll)

	var pad := MarginContainer.new()
	pad.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pad.add_theme_constant_override("margin_left", GRID_PAD)
	pad.add_theme_constant_override("margin_right", GRID_PAD)
	pad.add_theme_constant_override("margin_top", GRID_PAD)
	pad.add_theme_constant_override("margin_bottom", GRID_PAD)
	grid_scroll.add_child(pad)

	grid_container = GridContainer.new()
	grid_container.columns = GRID_COLUMNS
	grid_container.add_theme_constant_override("h_separation", 40)
	grid_container.add_theme_constant_override("v_separation", 40)
	grid_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pad.add_child(grid_container)

	_update_search_label()

func _build_keyboard() -> void:
	var kb_x := 70.0
	var kb_y := 170.0
	var wide_w := (KB_COLS * KEY_SIZE + (KB_COLS - 1) * KEY_GAP - KEY_GAP) / 2.0
	var wide_h := KEY_SIZE * 0.92

	space_node = _make_wide_key(KEY_SPACE_TEX)
	space_node.position = Vector2(kb_x, kb_y)
	space_node.size = Vector2(wide_w, wide_h)
	add_child(space_node)

	back_node = _make_wide_key(KEY_BACK_TEX)
	back_node.position = Vector2(kb_x + wide_w + KEY_GAP, kb_y)
	back_node.size = Vector2(wide_w, wide_h)
	add_child(back_node)

	var letters_y := kb_y + wide_h + KEY_GAP + 6
	key_nodes.clear()
	for i in range(LETTERS.length()):
		var col := i % KB_COLS
		var row := int(i / KB_COLS)
		var key := _make_letter_key(LETTERS[i])
		key.position = Vector2(kb_x + col * (KEY_SIZE + KEY_GAP), letters_y + row * (KEY_SIZE + KEY_GAP))
		add_child(key)
		key_nodes.append(key)
	_update_keyboard_visuals()

func _make_letter_key(letter: String) -> Control:
	var root := Control.new()
	root.size = Vector2(KEY_SIZE, KEY_SIZE)
	root.pivot_offset = Vector2(KEY_SIZE, KEY_SIZE) * 0.5

	var border := Panel.new()
	border.name = "Border"
	border.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	border.offset_left = -3
	border.offset_top = -3
	border.offset_right = 3
	border.offset_bottom = 3
	border.visible = false
	var bstyle := StyleBoxFlat.new()
	bstyle.bg_color = Color(0, 0, 0, 0)
	bstyle.set_border_width_all(4)
	bstyle.border_color = Color.BLACK
	bstyle.set_corner_radius_all(6)
	bstyle.shadow_color = Color(UIFactory.RED_GLOW.r, UIFactory.RED_GLOW.g, UIFactory.RED_GLOW.b, 0.7)
	bstyle.shadow_size = 14
	border.add_theme_stylebox_override("panel", bstyle)
	root.add_child(border)

	var bg := TextureRect.new()
	bg.texture = KEY_BTN_TEX
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(bg)

	var label := Label.new()
	label.text = letter
	label.add_theme_font_size_override("font_size", 40)
	label.add_theme_color_override("font_color", Color.WHITE)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(label)
	return root

func _make_wide_key(tex: Texture2D) -> Control:
	var root := Control.new()
	root.pivot_offset = Vector2(0, 0)

	var border := Panel.new()
	border.name = "Border"
	border.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	border.offset_left = -3
	border.offset_top = -3
	border.offset_right = 3
	border.offset_bottom = 3
	border.visible = false
	var bstyle := StyleBoxFlat.new()
	bstyle.bg_color = Color(0, 0, 0, 0)
	bstyle.set_border_width_all(4)
	bstyle.border_color = Color.BLACK
	bstyle.set_corner_radius_all(6)
	border.add_theme_stylebox_override("panel", bstyle)
	root.add_child(border)

	var bg := TextureRect.new()
	bg.texture = tex
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(bg)
	return root

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
		var card := UIFactory.make_cover_card(GRID_CARD_H)
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
	key.scale = Vector2(1.12, 1.12) if selected else Vector2.ONE
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
