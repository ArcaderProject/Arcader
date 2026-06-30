extends Node

var window: Window
var label: Label
var warning := false
var blink := 0.0

func _ready() -> void:
	Communicator.timer_started.connect(_on_timer_started)
	Communicator.timer_tick.connect(_on_timer_tick)
	Communicator.timer_stopped.connect(_on_timer_stopped)
	set_process(false)

func _on_timer_started(remaining_seconds: int) -> void:
	_ensure_window()
	_set_time(remaining_seconds, false)
	window.show()
	set_process(true)

func _on_timer_tick(remaining_seconds: int, warn: bool) -> void:
	_ensure_window()
	if not window.visible:
		window.show()
	set_process(true)
	_set_time(remaining_seconds, warn)

func _on_timer_stopped() -> void:
	set_process(false)
	if window:
		window.hide()

func _set_time(seconds: int, warn: bool) -> void:
	warning = warn
	label.text = _format(seconds)
	if not warn:
		label.modulate = Color.WHITE

func _format(seconds: int) -> String:
	if seconds < 0:
		seconds = 0
	return "%02d:%02d" % [seconds / 60, seconds % 60]

func _process(delta: float) -> void:
	if warning and label:
		blink += delta
		label.modulate = Color(1, 0.2, 0.2) if sin(blink * 8.0) > 0.0 else Color(1, 0.65, 0.65)

func _ensure_window() -> void:
	if window:
		return

	window = Window.new()
	window.borderless = true
	window.always_on_top = true
	window.transparent = true
	window.unfocusable = true
	window.size = Vector2i(240, 96)
	window.min_size = window.size
	get_tree().root.add_child(window)

	var bg := Panel.new()
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.55)
	style.set_corner_radius_all(16)
	style.set_border_width_all(2)
	style.border_color = Color(1, 0.16, 0.16, 0.9)
	bg.add_theme_stylebox_override("panel", style)
	window.add_child(bg)

	label = Label.new()
	label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 48)
	label.add_theme_color_override("font_color", Color.WHITE)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg.add_child(label)

	var screen := DisplayServer.screen_get_size()
	window.position = Vector2i((screen.x - window.size.x) / 2, 28)
