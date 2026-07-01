extends Node

const ITEMS := ["Resume", "Exit to Library"]

var window: Window
var title_label: Label
var item_labels: Array = []
var selected := 0
var time_mode := false

func _ready() -> void:
	Communicator.overlay_open.connect(_on_open)
	Communicator.overlay_nav.connect(_on_nav)
	Communicator.overlay_close.connect(_on_close)

func _on_open(data: Dictionary) -> void:
	_ensure_window()
	time_mode = bool(data.get("timeMode", false))
	selected = 0
	_update_title(int(data.get("remainingSeconds", 0)))
	_update_selection()
	window.show()

func _on_nav(action: String) -> void:
	if window == null or not window.visible:
		return
	match action:
		"up":
			selected = (selected - 1 + ITEMS.size()) % ITEMS.size()
			_update_selection()
		"down":
			selected = (selected + 1) % ITEMS.size()
			_update_selection()
		"select":
			_activate()
		"back":
			Communicator.resume_game()

func _on_close() -> void:
	if window:
		window.hide()

func _activate() -> void:
	match ITEMS[selected]:
		"Resume":
			Communicator.resume_game()
		"Exit to Library":
			Communicator.exit_game()

func _update_title(remaining_seconds: int) -> void:
	if time_mode:
		title_label.text = "PAUSED   %02d:%02d" % [remaining_seconds / 60, remaining_seconds % 60]
	else:
		title_label.text = "PAUSED"

func _update_selection() -> void:
	for i in range(item_labels.size()):
		var sel := i == selected
		var label: Label = item_labels[i]
		label.text = ("> %s <" % ITEMS[i]) if sel else ITEMS[i]
		label.add_theme_color_override("font_color", UIFactory.RED_GLOW if sel else Color.WHITE)

func _ensure_window() -> void:
	if window:
		return

	window = preload("res://scenes/GameMenu.tscn").instantiate()
	title_label = window.get_node("Panel/VBox/Title")
	item_labels = [window.get_node("Panel/VBox/Item0"), window.get_node("Panel/VBox/Item1")]
	get_tree().root.add_child(window)

	var screen := DisplayServer.screen_get_size()
	window.position = Vector2i((screen.x - window.size.x) / 2, (screen.y - window.size.y) / 2)
