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

	window = Window.new()
	window.borderless = true
	window.always_on_top = true
	window.transparent = true
	window.unfocusable = true
	window.size = Vector2i(560, 360)
	window.min_size = window.size
	get_tree().root.add_child(window)

	var bg := Panel.new()
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.78)
	style.set_corner_radius_all(20)
	style.set_border_width_all(3)
	style.border_color = UIFactory.RED_GLOW
	bg.add_theme_stylebox_override("panel", style)
	window.add_child(bg)

	var vbox := VBoxContainer.new()
	vbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	vbox.offset_left = 40
	vbox.offset_right = -40
	vbox.offset_top = 40
	vbox.offset_bottom = -40
	vbox.add_theme_constant_override("separation", 28)
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	bg.add_child(vbox)

	title_label = Label.new()
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.add_theme_font_size_override("font_size", 52)
	title_label.add_theme_color_override("font_color", Color.WHITE)
	vbox.add_child(title_label)

	item_labels = []
	for item in ITEMS:
		var label := Label.new()
		label.text = item
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", 40)
		vbox.add_child(label)
		item_labels.append(label)

	var screen := DisplayServer.screen_get_size()
	window.position = Vector2i((screen.x - window.size.x) / 2, (screen.y - window.size.y) / 2)
