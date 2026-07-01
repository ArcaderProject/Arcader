extends Control

enum State { SELECT, PROGRESS, RESULT }

const CATS := [
	{"key": "games", "label": "GAMES"},
	{"key": "saves", "label": "SAVESTATES"},
	{"key": "lists", "label": "LISTS"},
	{"key": "settings", "label": "ARCADER SETTINGS"},
]

const Z_MODE := "mode"
const Z_LEFT := "left"
const Z_RIGHT := "right"
const Z_CONFIRM := "confirm"

const PANEL_W := 660.0
const ROW_TOP := 96.0
const ROW_H := 66.0
const ROW_PAD := 34.0
const TRACK_W := 760.0
const FILL_W := 240.0
const NAV := ["ui_up", "ui_down", "ui_left", "ui_right", "ui_accept", "ui_select", "ui_cancel"]

@onready var title_label: Label = $Title
@onready var export_label: Label = $ModeExport
@onready var import_label: Label = $ModeImport
@onready var mode_caret: Label = $ModeCaret
@onready var left_panel: Panel = $LeftPanel
@onready var right_panel: Panel = $RightPanel
@onready var left_cursor: Panel = $LeftPanel/Cursor
@onready var right_cursor: Panel = $RightPanel/Cursor
@onready var left_empty: Label = $LeftPanel/EmptyNote
@onready var right_empty: Label = $RightPanel/EmptyNote
@onready var left_rows_host: Control = $LeftPanel/Rows
@onready var right_rows_host: Control = $RightPanel/Rows
@onready var confirm_panel: Panel = $Confirm
@onready var confirm_label: Label = $Confirm/Label
@onready var progress_group: Control = $Progress
@onready var progress_label: Label = $Progress/Label
@onready var progress_fill: Panel = $Progress/Track/Fill
@onready var result_label: Label = $Result

var state: int = State.SELECT
var mode: String = "export"
var focus: String = Z_LEFT
var left_index: int = 0
var right_index: int = 0

var available: Array = []
var selected: Array = []
var availability := {}
var has_scan := false
var busy := false

var left_rows: Array = []
var right_rows: Array = []
var _anim_t := 0.0

func _ready() -> void:
	Communicator.usb_progress.connect(_on_progress)
	Communicator.usb_scan.connect(_on_scan)
	Communicator.usb_export_done.connect(_on_transfer_done)
	Communicator.usb_import_done.connect(_on_transfer_done)

	_set_mode("export")
	_enter_select()

func _enter_select() -> void:
	state = State.SELECT
	_show_select(true)
	progress_group.visible = false
	result_label.visible = false
	title_label.text = "USB TRANSFER"
	title_label.add_theme_color_override("font_color", UIFactory.RED)
	_reset_lists()
	focus = Z_LEFT if not available.is_empty() else Z_MODE
	left_index = 0
	right_index = 0
	_rebuild_rows()
	_refresh()

func _show_select(visible_flag: bool) -> void:
	for n in [export_label, import_label, mode_caret, left_panel, right_panel, confirm_panel]:
		n.visible = visible_flag

func _set_mode(new_mode: String) -> void:
	mode = new_mode
	has_scan = false
	availability = {}
	if mode == "import":
		Communicator.usb_scan_stick()
	export_label.add_theme_color_override("font_color", UIFactory.RED_GLOW if mode == "export" else Color(0.7, 0.7, 0.75))
	import_label.add_theme_color_override("font_color", UIFactory.RED_GLOW if mode == "import" else Color(0.7, 0.7, 0.75))

	_reset_lists()
	left_index = 0
	right_index = 0
	if focus == Z_LEFT or focus == Z_RIGHT:
		focus = Z_LEFT if not available.is_empty() else Z_MODE
	if is_inside_tree():
		_rebuild_rows()

func _movable(key: String) -> bool:
	if mode == "export":
		return true
	return has_scan and int(availability.get(key, 0)) > 0

func _reset_lists() -> void:
	available = []
	selected = []
	for cat in CATS:
		if mode == "export" or _movable(cat["key"]):
			available.append(cat["key"])

func _label_for(key: String) -> String:
	for cat in CATS:
		if cat["key"] == key:
			if mode == "import" and has_scan:
				return "%s  (%d)" % [cat["label"], int(availability.get(key, 0))]
			return cat["label"]
	return key

func _rebuild_rows() -> void:
	for r in left_rows:
		r.queue_free()
	for r in right_rows:
		r.queue_free()
	left_rows.clear()
	right_rows.clear()

	for i in range(available.size()):
		left_rows.append(_make_row(left_rows_host, available[i], i))
	for i in range(selected.size()):
		right_rows.append(_make_row(right_rows_host, selected[i], i))

	left_empty.visible = available.is_empty()
	right_empty.visible = selected.is_empty()

func _make_row(host: Control, key: String, index: int) -> Label:
	var row := Label.new()
	row.add_theme_font_size_override("font_size", 34)
	row.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	row.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.position = Vector2(ROW_PAD + 14, ROW_TOP + index * ROW_H)
	row.size = Vector2(PANEL_W - ROW_PAD * 2 - 14, ROW_H - 8)
	row.text = _label_for(key)
	host.add_child(row)
	return row

func _refresh() -> void:
	left_panel.add_theme_stylebox_override("panel", _panel_style(focus == Z_LEFT))
	right_panel.add_theme_stylebox_override("panel", _panel_style(focus == Z_RIGHT))

	_position_cursor(left_cursor, left_rows, left_index, focus == Z_LEFT)
	_position_cursor(right_cursor, right_rows, right_index, focus == Z_RIGHT)

	for i in range(left_rows.size()):
		left_rows[i].add_theme_color_override("font_color", Color.WHITE if (focus == Z_LEFT and i == left_index) else Color(0.72, 0.72, 0.78))
	for i in range(right_rows.size()):
		right_rows[i].add_theme_color_override("font_color", Color.WHITE if (focus == Z_RIGHT and i == right_index) else Color(0.72, 0.72, 0.78))

	var mode_focused := focus == Z_MODE
	export_label.modulate = Color(1.35, 1.35, 1.35) if (mode_focused and mode == "export") else Color.WHITE
	import_label.modulate = Color(1.35, 1.35, 1.35) if (mode_focused and mode == "import") else Color.WHITE
	export_label.text = "> EXPORT" if mode == "export" else "EXPORT"
	import_label.text = "IMPORT <" if mode == "import" else "IMPORT"

	var can_confirm := not selected.is_empty()
	var cstyle := StyleBoxFlat.new()
	cstyle.set_corner_radius_all(16)
	if focus == Z_CONFIRM and can_confirm:
		cstyle.bg_color = UIFactory.RED
		cstyle.set_border_width_all(3)
		cstyle.border_color = UIFactory.RED_GLOW
		cstyle.shadow_color = Color(UIFactory.RED_GLOW.r, UIFactory.RED_GLOW.g, UIFactory.RED_GLOW.b, 0.5)
		cstyle.shadow_size = 22
	else:
		cstyle.bg_color = Color(0.12, 0.04, 0.04, 0.85) if can_confirm else Color(0.1, 0.1, 0.12, 0.7)
		cstyle.set_border_width_all(2)
		cstyle.border_color = Color(0.5, 0.15, 0.15, 0.9) if can_confirm else Color(0.3, 0.3, 0.34, 0.8)
	confirm_panel.add_theme_stylebox_override("panel", cstyle)
	confirm_label.add_theme_color_override("font_color", Color.WHITE if can_confirm else Color(0.55, 0.55, 0.6))
	confirm_label.text = "CONFIRM" if can_confirm else "SELECT DATA"

func _panel_style(focused: bool) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.03, 0.05, 0.72)
	style.set_corner_radius_all(20)
	style.set_border_width_all(3)
	style.border_color = UIFactory.RED_GLOW if focused else Color(0.35, 0.12, 0.12, 0.9)
	if focused:
		style.shadow_color = Color(UIFactory.RED_GLOW.r, UIFactory.RED_GLOW.g, UIFactory.RED_GLOW.b, 0.35)
		style.shadow_size = 18
	return style

func _position_cursor(cursor: Panel, rows: Array, index: int, active: bool) -> void:
	if not active or rows.is_empty():
		cursor.visible = false
		return
	cursor.visible = true
	cursor.position = Vector2(ROW_PAD, ROW_TOP - 4 + index * ROW_H)

func _input(event: InputEvent) -> void:
	var ours := false
	for a in NAV:
		if event.is_action_pressed(a):
			ours = true
			break
	if not ours:
		return
	get_viewport().set_input_as_handled()

	if busy or state == State.PROGRESS:
		return
	if state == State.RESULT:
		if event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select") or event.is_action_pressed("ui_cancel"):
			_enter_select()
		return

	if event.is_action_pressed("ui_up"):
		_nav_up()
	elif event.is_action_pressed("ui_down"):
		_nav_down()
	elif event.is_action_pressed("ui_left"):
		_nav_left()
	elif event.is_action_pressed("ui_right"):
		_nav_right()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		_activate()
	_refresh()

func _nav_up() -> void:
	match focus:
		Z_LEFT:
			if left_index > 0: left_index -= 1
			else: focus = Z_MODE
		Z_RIGHT:
			if right_index > 0: right_index -= 1
			else: focus = Z_MODE
		Z_CONFIRM:
			focus = Z_LEFT if not available.is_empty() else (Z_RIGHT if not selected.is_empty() else Z_MODE)

func _nav_down() -> void:
	match focus:
		Z_MODE:
			focus = Z_LEFT if not available.is_empty() else (Z_RIGHT if not selected.is_empty() else Z_CONFIRM)
		Z_LEFT:
			if left_index < available.size() - 1: left_index += 1
			else: focus = Z_CONFIRM
		Z_RIGHT:
			if right_index < selected.size() - 1: right_index += 1
			else: focus = Z_CONFIRM

func _nav_left() -> void:
	match focus:
		Z_MODE:
			_set_mode("export")
		Z_RIGHT:
			focus = Z_LEFT if not available.is_empty() else Z_RIGHT

func _nav_right() -> void:
	match focus:
		Z_MODE:
			_set_mode("import")
		Z_LEFT:
			focus = Z_RIGHT if not selected.is_empty() else Z_LEFT

func _activate() -> void:
	match focus:
		Z_LEFT:
			_shuttle(true)
		Z_RIGHT:
			_shuttle(false)
		Z_CONFIRM:
			_start_transfer()
		Z_MODE:
			focus = Z_LEFT if not available.is_empty() else Z_CONFIRM

func _shuttle(to_selected: bool) -> void:
	if to_selected:
		if left_index >= available.size():
			return
		var key = available[left_index]
		available.remove_at(left_index)
		selected.append(key)
		_sort_by_cats(selected)
		left_index = clampi(left_index, 0, max(available.size() - 1, 0))
	else:
		if right_index >= selected.size():
			return
		var key = selected[right_index]
		selected.remove_at(right_index)
		available.append(key)
		_sort_by_cats(available)
		right_index = clampi(right_index, 0, max(selected.size() - 1, 0))

	_rebuild_rows()

	if focus == Z_LEFT and available.is_empty():
		focus = Z_RIGHT if not selected.is_empty() else Z_CONFIRM
	elif focus == Z_RIGHT and selected.is_empty():
		focus = Z_LEFT if not available.is_empty() else Z_MODE

func _sort_by_cats(arr: Array) -> void:
	var order := {}
	for i in range(CATS.size()):
		order[CATS[i]["key"]] = i
	arr.sort_custom(func(a, b): return int(order.get(a, 99)) < int(order.get(b, 99)))

func _start_transfer() -> void:
	if selected.is_empty():
		return
	busy = true
	_enter_progress()
	if mode == "export":
		Communicator.usb_export(selected.duplicate())
	else:
		Communicator.usb_import(selected.duplicate())

func _enter_progress() -> void:
	state = State.PROGRESS
	_show_select(false)
	result_label.visible = false
	progress_group.visible = true
	title_label.text = "EXPORTING…" if mode == "export" else "IMPORTING…"
	progress_label.text = "Working…"
	_anim_t = 0.0

func _process(delta: float) -> void:
	if state != State.PROGRESS:
		return
	_anim_t += delta
	var span := TRACK_W - FILL_W - 8.0
	progress_fill.position.x = 4.0 + span * (0.5 + 0.5 * sin(_anim_t * 2.4))

func _enter_result(summary: String, ok: bool) -> void:
	state = State.RESULT
	_show_select(false)
	progress_group.visible = false
	result_label.visible = true
	title_label.text = "DONE" if ok else "FAILED"
	title_label.add_theme_color_override("font_color", UIFactory.RED if ok else UIFactory.RED_GLOW)
	result_label.text = summary

func _on_progress(data: Dictionary) -> void:
	if state != State.PROGRESS:
		return
	var stage := String(data.get("stage", ""))
	var current := int(data.get("current", 0))
	var total := int(data.get("total", 0))
	if stage != "":
		progress_label.text = "%s  %d/%d" % [stage.capitalize(), current, max(current, total)]

func _on_scan(data: Dictionary) -> void:
	if mode != "import":
		return
	has_scan = true
	if bool(data.get("hasBackup", false)):
		var contents: Dictionary = data.get("contents", {})
		availability = {
			"games": int(contents.get("games", 0)),
			"saves": int(contents.get("saves", 0)),
			"lists": int(contents.get("lists", 0)),
			"settings": int(contents.get("settings", 0)),
		}
	else:
		availability = {"games": 0, "saves": 0, "lists": 0, "settings": 0}
	if state == State.SELECT:
		_reset_lists()
		left_index = 0
		right_index = 0
		focus = Z_LEFT if not available.is_empty() else Z_MODE
		_rebuild_rows()
		_refresh()

func _on_transfer_done(msg: Dictionary) -> void:
	if state != State.PROGRESS:
		return
	busy = false
	if bool(msg.get("success", false)):
		_enter_result(_summary_text(msg.get("data", {})), true)
	else:
		_enter_result("Error: %s" % String(msg.get("error", "unknown")), false)

func _summary_text(data: Dictionary) -> String:
	if mode == "export":
		var parts: Array = []
		for key in ["games", "saves", "lists", "settings"]:
			if data.has(key):
				parts.append("%d %s" % [int(data[key]), key])
		return "Exported to USB:\n" + ", ".join(parts)

	var added := int(data.get("games_added", 0))
	var dup := int(data.get("games_duplicate", 0))
	var lines: Array = [
		"%d games added%s" % [added, ("  (%d duplicate skipped)" % dup) if dup > 0 else ""],
		"%d lists merged" % int(data.get("lists", 0)),
		"%d save files" % int(data.get("saves", 0)),
		"%d settings applied" % int(data.get("settings", 0)),
	]
	return "Imported from USB:\n" + "\n".join(lines)
