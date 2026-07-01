extends Control

@onready var pills: Array = [$Pill0, $Pill1]

var actions := ["games", "search"]
var selected_index: int = 0

func _ready() -> void:
	_update_selection()

func _update_selection() -> void:
	for i in range(pills.size()):
		var sel := i == selected_index
		var pill: Control = pills[i]
		pill.scale = Vector2(1.08, 1.08) if sel else Vector2.ONE
		pill.modulate = Color(1.25, 1.2, 1.2) if sel else Color.WHITE

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_down"):
		selected_index = (selected_index + 1) % actions.size()
		_update_selection()
	elif event.is_action_pressed("ui_up"):
		selected_index = (selected_index - 1 + actions.size()) % actions.size()
		_update_selection()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_activate()

func _activate() -> void:
	match actions[selected_index]:
		"games":
			ScreenManager.change_to_games_list()
		"search":
			ScreenManager.change_to_search()
