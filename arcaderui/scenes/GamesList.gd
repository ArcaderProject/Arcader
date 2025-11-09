extends Control

@onready var games_container: VBoxContainer = %GamesContainer
@onready var loading_label: Label = %LoadingLabel
@onready var error_label: Label = %ErrorLabel

var game_items: Array = []
var selected_index: int = 0

func _ready() -> void:
	Communicator.games_received.connect(_on_games_received)
	Communicator.games_error.connect(_on_games_error)
	Communicator.game_start_error.connect(_on_game_start_error)
	
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
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_activate_selected()

func _navigate_down() -> void:
	selected_index = (selected_index + 1) % game_items.size()
	_update_selection()

func _navigate_up() -> void:
	selected_index = (selected_index - 1 + game_items.size()) % game_items.size()
	_update_selection()

func _update_selection() -> void:
	for i in range(game_items.size()):
		var item = game_items[i]
		if i == selected_index:
			item.modulate = Color(1.5, 1.5, 1.5)
		else:
			item.modulate = Color(1, 1, 1)

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
	var container = HBoxContainer.new()
	container.set_meta("game_data", game)
	container.custom_minimum_size = Vector2(0, 90)
	
	var cover_rect = TextureRect.new()
	cover_rect.custom_minimum_size = Vector2(80, 80)
	cover_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	cover_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	
	if game.get("cover_data"):
		var image = Image.new()
		var buffer = Marshalls.base64_to_raw(game["cover_data"])
		
		var error = image.load_png_from_buffer(buffer)
		if error != OK:
			error = image.load_jpg_from_buffer(buffer)
		
		if error == OK:
			cover_rect.texture = ImageTexture.create_from_image(image)
		else:
			cover_rect.texture = _create_placeholder_texture()
	else:
		cover_rect.texture = _create_placeholder_texture()
	
	container.add_child(cover_rect)
	
	var spacer = Control.new()
	spacer.custom_minimum_size = Vector2(10, 0)
	container.add_child(spacer)
	
	var label = Label.new()
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	
	var text = ""
	if game.has("console") and game["console"]:
		text += "[" + game["console"] + "] "
	
	text += game.get("name", "Unknown Game")
	
	if game.has("extension"):
		text += " (." + game["extension"] + ")"
	
	label.text = text
	label.add_theme_font_size_override("font_size", 20)
	
	container.add_child(label)
	
	return container

func _create_placeholder_texture() -> ImageTexture:
	var image = Image.create(80, 80, false, Image.FORMAT_RGB8)
	image.fill(Color(0.2, 0.2, 0.2))
	
	for x in range(10, 70):
		for y in range(10, 70):
			image.set_pixel(x, y, Color(0.3, 0.3, 0.3))
	
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
