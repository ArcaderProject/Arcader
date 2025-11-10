extends Control

@onready var games_container: GridContainer = %GamesContainer
@onready var scroll_container: ScrollContainer = %ScrollContainer
@onready var loading_label: Label = %LoadingLabel
@onready var error_label: Label = %ErrorLabel

var game_items: Array = []
var selected_index: int = 0
var cover_cache: Dictionary = {}
var cards_per_row: int = 5

func _ready() -> void:
	Communicator.games_received.connect(_on_games_received)
	Communicator.games_error.connect(_on_games_error)
	Communicator.game_start_error.connect(_on_game_start_error)
	Communicator.cover_received.connect(_on_cover_received)
	Communicator.connection_restored.connect(_on_connection_restored)

	games_container.columns = cards_per_row
	
	loading_label.visible = true
	error_label.visible = false
	Communicator.get_games()

func _unhandled_input(event: InputEvent) -> void:
	if game_items.is_empty():
		return
	
	if event.is_action_pressed("ui_down"):
		_navigate_down()
	elif event.is_action_pressed("ui_up"):
		_navigate_up()
	elif event.is_action_pressed("ui_left"):
		_navigate_left()
	elif event.is_action_pressed("ui_right"):
		_navigate_right()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_activate_selected()

func _navigate_down() -> void:
	var new_index = selected_index + cards_per_row
	if new_index < game_items.size():
		selected_index = new_index
		_update_selection()
		_auto_scroll()

func _navigate_up() -> void:
	var new_index = selected_index - cards_per_row
	if new_index >= 0:
		selected_index = new_index
		_update_selection()
		_auto_scroll()

func _navigate_left() -> void:
	if selected_index > 0:
		selected_index -= 1
		_update_selection()
		_auto_scroll()

func _navigate_right() -> void:
	if selected_index < game_items.size() - 1:
		selected_index += 1
		_update_selection()
		_auto_scroll()

func _update_selection() -> void:
	for i in range(game_items.size()):
		var item = game_items[i]
		var panel = item as Panel
		
		if i == selected_index:
			item.z_index = 10

			item.pivot_offset = item.size / 2

			item.modulate = Color(1.2, 1.3, 1.5)
			item.scale = Vector2(1.08, 1.08)

			var style = StyleBoxFlat.new()
			style.bg_color = Color(0.1, 0.1, 0.15, 0.9)
			style.border_width_left = 4
			style.border_width_right = 4
			style.border_width_top = 4
			style.border_width_bottom = 4
			style.border_color = Color(0, 0.8, 1.0, 1.0)
			style.corner_radius_top_left = 8
			style.corner_radius_top_right = 8
			style.corner_radius_bottom_left = 8
			style.corner_radius_bottom_right = 8
			style.shadow_size = 15
			style.shadow_color = Color(0, 0.6, 1.0, 0.6)
			panel.add_theme_stylebox_override("panel", style)
		else:
			item.z_index = 0

			item.pivot_offset = Vector2.ZERO
			item.modulate = Color(1, 1, 1)
			item.scale = Vector2(1, 1)

			var style = StyleBoxFlat.new()
			style.bg_color = Color(0.15, 0.15, 0.2, 0.8)
			style.border_width_left = 2
			style.border_width_right = 2
			style.border_width_top = 2
			style.border_width_bottom = 2
			style.border_color = Color(0.3, 0.3, 0.35, 0.5)
			style.corner_radius_top_left = 8
			style.corner_radius_top_right = 8
			style.corner_radius_bottom_left = 8
			style.corner_radius_bottom_right = 8
			panel.add_theme_stylebox_override("panel", style)

func _auto_scroll() -> void:
	if not scroll_container or game_items.is_empty():
		return
	
	var selected_card = game_items[selected_index]
	var card_pos = selected_card.global_position
	var card_size = selected_card.size
	var container_size = scroll_container.size

	var card_top = card_pos.y - scroll_container.global_position.y
	var card_bottom = card_top + card_size.y

	if card_bottom > container_size.y:
		scroll_container.scroll_vertical += card_bottom - container_size.y + 20
	elif card_top < 0:
		scroll_container.scroll_vertical += card_top - 20

func _activate_selected() -> void:
	if selected_index < game_items.size():
		var game = game_items[selected_index].get_meta("game_data")
		_on_game_item_activated(game)

func _on_games_received(games: Array) -> void:
	loading_label.visible = false
	error_label.visible = false
	
	for child in games_container.get_children():
		child.queue_free()
	
	game_items.clear()
	selected_index = 0
	
	if games.is_empty():
		var no_games_label = Label.new()
		no_games_label.text = "No games found"
		no_games_label.add_theme_font_size_override("font_size", 20)
		no_games_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		games_container.add_child(no_games_label)
		return
	
	for game in games:
		var game_item = _create_game_item(game)
		games_container.add_child(game_item)
		game_items.append(game_item)
	
	if not game_items.is_empty():
		_update_selection()

func _create_game_item(game: Dictionary) -> Control:
	var card = Panel.new()
	card.set_meta("game_data", game)
	card.custom_minimum_size = Vector2(200, 280)

	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.15, 0.15, 0.2, 0.8)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.3, 0.3, 0.35, 0.5)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	card.add_theme_stylebox_override("panel", style)

	var margin = MarginContainer.new()
	margin.anchor_right = 1.0
	margin.anchor_bottom = 1.0
	margin.add_theme_constant_override("margin_left", 6)
	margin.add_theme_constant_override("margin_right", 6)
	margin.add_theme_constant_override("margin_top", 6)
	margin.add_theme_constant_override("margin_bottom", 6)
	card.add_child(margin)

	var cover_rect = TextureRect.new()
	cover_rect.custom_minimum_size = Vector2(188, 268)
	cover_rect.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cover_rect.size_flags_vertical = Control.SIZE_EXPAND_FILL
	cover_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	cover_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	cover_rect.name = "CoverRect"
	cover_rect.clip_contents = true

	cover_rect.texture = _create_placeholder_texture()

	if game.get("cover_art", false):
		var game_id = game.get("id", "")
		if game_id:
			if cover_cache.has(game_id):
				_set_cover_texture(cover_rect, cover_cache[game_id])
			else:
				Communicator.get_cover(game_id)
	
	margin.add_child(cover_rect)
	
	return card

func _create_placeholder_texture() -> ImageTexture:
	var image = Image.create(188, 268, false, Image.FORMAT_RGB8)
	image.fill(Color(0.2, 0.2, 0.2))

	for x in range(5, 183):
		for y in range(5, 263):
			image.set_pixel(x, y, Color(0.25, 0.25, 0.3))
	
	return ImageTexture.create_from_image(image)

func _on_game_item_activated(game: Dictionary) -> void:
	var game_id = game.get("id", "")
	if not game_id:
		return
	
	Communicator.start_game(game_id)

func _on_game_start_error(error: String) -> void:
	error_label.visible = true
	error_label.text = "Error starting game: " + error

func _on_games_error(error: String) -> void:
	loading_label.visible = false
	error_label.visible = true
	error_label.text = "Error: " + error

func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/MainMenu.tscn")

func _on_cover_received(game_id: String, cover_data: String) -> void:
	cover_cache[game_id] = cover_data
	
	for item in game_items:
		var game = item.get_meta("game_data")
		if game.get("id") == game_id:
			var margin = item.get_child(0) if item.get_child_count() > 0 else null
			if margin:
				var cover_rect = margin.get_node_or_null("CoverRect")
				if cover_rect:
					_set_cover_texture(cover_rect, cover_data)

func _set_cover_texture(cover_rect: TextureRect, cover_data: String) -> void:
	if not cover_data or cover_data == "":
		return
	
	var image = Image.new()
	var buffer = Marshalls.base64_to_raw(cover_data)
	
	var error = image.load_png_from_buffer(buffer)
	if error != OK:
		error = image.load_jpg_from_buffer(buffer)
	
	if error == OK:
		cover_rect.texture = ImageTexture.create_from_image(image)

func _on_connection_restored() -> void:
	loading_label.visible = true
	error_label.visible = false
	Communicator.get_games()
