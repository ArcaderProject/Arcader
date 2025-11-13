extends Node2D

@onready var games_button: Button = %GamesButton

var menu_buttons: Array[Button] = []
var selected_index: int = 0

func _ready() -> void:
	menu_buttons = [games_button]
	
	if not menu_buttons.is_empty():
		menu_buttons[0].grab_focus()

func _unhandled_input(event: InputEvent) -> void:
	if menu_buttons.is_empty():
		return
	
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_activate_selected()

func _activate_selected() -> void:
	if selected_index < menu_buttons.size():
		menu_buttons[selected_index].emit_signal("pressed")

func _on_games_button_pressed() -> void:
	ScreenManager.change_to_games_list()

func _on_quit_button_pressed() -> void:
	get_tree().quit()
