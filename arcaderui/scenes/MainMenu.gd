extends Control

const BANNER := preload("res://assets/banner.png")

var entries := [
	{"label": "Select Game", "action": "games"},
	{"label": "Search", "action": "search"},
]
var pills: Array = []
var selected_index: int = 0

func _ready() -> void:
	add_child(UIFactory.make_background())

	var banner := TextureRect.new()
	banner.texture = BANNER
	banner.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	banner.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	banner.position = Vector2(960 - 420, 150)
	banner.size = Vector2(840, 230)
	add_child(banner)

	var pill_w := 560.0
	var pill_h := UIFactory.PILL_H
	var start_y := 560.0
	for i in range(entries.size()):
		var pill := UIFactory.make_pill(entries[i]["label"], 44)
		pill.size = Vector2(pill_w, pill_h)
		pill.position = Vector2(960 - pill_w * 0.5, start_y + i * (pill_h + 50))
		pill.pivot_offset = Vector2(pill_w, pill_h) * 0.5
		add_child(pill)
		pills.append(pill)
	_update_selection()

func _update_selection() -> void:
	for i in range(pills.size()):
		var sel := i == selected_index
		var pill: Control = pills[i]
		pill.scale = Vector2(1.08, 1.08) if sel else Vector2.ONE
		pill.modulate = Color(1.25, 1.2, 1.2) if sel else Color.WHITE

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_down"):
		selected_index = (selected_index + 1) % entries.size()
		_update_selection()
	elif event.is_action_pressed("ui_up"):
		selected_index = (selected_index - 1 + entries.size()) % entries.size()
		_update_selection()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_activate()

func _activate() -> void:
	match entries[selected_index]["action"]:
		"games":
			ScreenManager.change_to_games_list()
		"search":
			ScreenManager.change_to_search()
