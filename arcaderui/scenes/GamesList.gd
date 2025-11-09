extends Control

@onready var games_container: VBoxContainer = %GamesContainer
@onready var loading_label: Label = %LoadingLabel
@onready var error_label: Label = %ErrorLabel

var game_buttons: Array[Button] = []
var selected_index: int = 0

func _ready() -> void:
	Communicator.games_received.connect(_on_games_received)
	Communicator.games_error.connect(_on_games_error)
	Communicator.game_start_error.connect(_on_game_start_error)
	
	loading_label.visible = true
	error_label.visible = false
	Communicator.get_games()

func _unhandled_input(event: InputEvent) -> void:
	if game_buttons.is_empty():
		return
	
	if event.is_action_pressed("ui_down"):
		_navigate_down()
	elif event.is_action_pressed("ui_up"):
		_navigate_up()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_activate_selected()

func _navigate_down() -> void:
	selected_index = (selected_index + 1) % game_buttons.size()
	game_buttons[selected_index].grab_focus()

func _navigate_up() -> void:
	selected_index = (selected_index - 1 + game_buttons.size()) % game_buttons.size()
	game_buttons[selected_index].grab_focus()

func _activate_selected() -> void:
	if selected_index < game_buttons.size():
		game_buttons[selected_index].emit_signal("pressed")

func _on_games_received(games: Array) -> void:
	loading_label.visible = false
	error_label.visible = false
	
	for child in games_container.get_children():
		child.queue_free()
	
	game_buttons.clear()
	selected_index = 0
	
	if games.is_empty():
		var no_games_label = Label.new()
		no_games_label.text = "No games found"
		no_games_label.add_theme_font_size_override("font_size", 20)
		no_games_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		games_container.add_child(no_games_label)
		return
	
	for game in games:
		var game_button = _create_game_button(game)
		games_container.add_child(game_button)
		game_buttons.append(game_button)
	
	if not game_buttons.is_empty():
		game_buttons[0].grab_focus()

func _create_game_button(game: Dictionary) -> Button:
	var button = Button.new()
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	
	var text = ""
	if game.has("console") and game["console"]:
		text += "[" + game["console"] + "] "
	
	text += game.get("name", "Unknown Game")
	
	if game.has("extension"):
		text += " (." + game["extension"] + ")"
	
	button.text = text
	button.add_theme_font_size_override("font_size", 20)
	button.set_meta("game_data", game)
	button.pressed.connect(_on_game_button_pressed.bind(game))
	
	return button

func _on_game_button_pressed(game: Dictionary) -> void:
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
