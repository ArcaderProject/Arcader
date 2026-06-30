extends Control

const COIN_BG := preload("res://assets/sprites/coin_background.png")
const ACCEPTOR := preload("res://assets/sprites/acceptor.png")
const COIN := preload("res://assets/sprites/coin.png")
const BANNER := preload("res://assets/banner.png")

const KONAMI_SEQUENCE := [
	KEY_UP, KEY_UP, KEY_DOWN, KEY_DOWN,
	KEY_LEFT, KEY_RIGHT, KEY_LEFT, KEY_RIGHT,
	KEY_B, KEY_A,
]

const SLOT_VERTICAL_FRACTION := 0.22
const SLOT_CENTER_X := 960.0
const COIN_SLIDE_DURATION := 1.8

var acceptor_pos := Vector2(960 - 150, 250)
var acceptor_size := Vector2(300, 360)
var coin_size := Vector2(72, 72)

var coin_sprite: TextureRect
var insert_label: Label
var info_label: Label
var credits_label: Label
var hardware_label: Label

var coin_start_x := 0.0
var coin_end_x := 0.0
var coin_y := 0.0
var coin_slide_t := 0.0

var konami_enabled := false
var konami_progress := 0
var proceeding := false
var blink_time := 0.0

func _ready() -> void:
	var bg := TextureRect.new()
	bg.texture = COIN_BG
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg.z_index = -100
	add_child(bg)

	var banner := TextureRect.new()
	banner.texture = BANNER
	banner.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	banner.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	banner.position = Vector2(960 - 360, 60)
	banner.size = Vector2(720, 180)
	add_child(banner)

	var acceptor := TextureRect.new()
	acceptor.texture = ACCEPTOR
	acceptor.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	acceptor.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	acceptor.position = acceptor_pos
	acceptor.size = acceptor_size
	add_child(acceptor)

	coin_y = acceptor_pos.y + acceptor_size.y * SLOT_VERTICAL_FRACTION - coin_size.y * 0.5
	coin_start_x = acceptor_pos.x + acceptor_size.x + 100
	coin_end_x = SLOT_CENTER_X - coin_size.x

	var coin_clip := Control.new()
	coin_clip.clip_contents = true
	coin_clip.position = Vector2(SLOT_CENTER_X, coin_y)
	coin_clip.size = Vector2(1920.0 - SLOT_CENTER_X, coin_size.y)
	coin_clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(coin_clip)

	coin_sprite = TextureRect.new()
	coin_sprite.texture = COIN
	coin_sprite.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	coin_sprite.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	coin_sprite.size = coin_size
	coin_sprite.position = Vector2(coin_start_x - SLOT_CENTER_X, 0)
	coin_clip.add_child(coin_sprite)

	insert_label = _make_label("INSERT COIN", 84, UIFactory.RED_GLOW)
	insert_label.size = Vector2(1400, 120)
	insert_label.position = Vector2(960 - 700, acceptor_pos.y + acceptor_size.y + 30)
	add_child(insert_label)

	info_label = _make_label("", 34, Color.WHITE)
	info_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info_label.size = Vector2(1200, 110)
	info_label.position = Vector2(960 - 600, acceptor_pos.y + acceptor_size.y + 160)
	add_child(info_label)

	credits_label = _make_label("", 40, Color(1, 0.85, 0.2))
	credits_label.size = Vector2(1200, 60)
	credits_label.position = Vector2(960 - 600, acceptor_pos.y + acceptor_size.y + 270)
	add_child(credits_label)

	hardware_label = _make_label("", 24, Color(1, 0.7, 0.2))
	hardware_label.size = Vector2(1200, 40)
	hardware_label.position = Vector2(960 - 600, 1030)
	add_child(hardware_label)

	if Communicator.has_signal("coin_status"):
		Communicator.coin_status.connect(_on_coin_status)
	if Communicator.has_signal("coin_inserted"):
		Communicator.coin_inserted.connect(_on_coin_inserted)
	Communicator.get_coin_status()

func _make_label(text: String, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return label

func _process(delta: float) -> void:
	blink_time += delta
	insert_label.modulate.a = 0.55 + 0.45 * sin(blink_time * 3.0)

	coin_slide_t += delta / COIN_SLIDE_DURATION
	if coin_slide_t >= 1.0:
		coin_slide_t -= 1.0
	var eased := smoothstep(0.0, 1.0, coin_slide_t)
	coin_sprite.position.x = lerpf(coin_start_x, coin_end_x, eased) - SLOT_CENTER_X
	coin_sprite.modulate.a = clampf(coin_slide_t / 0.1, 0.0, 1.0)

func _on_coin_status(status: Dictionary) -> void:
	if String(status.get("insertMessage", "")) != "":
		insert_label.text = String(status["insertMessage"])
	if status.has("infoMessage"):
		info_label.text = String(status["infoMessage"])
	konami_enabled = bool(status.get("konamiCodeEnabled", false))

	if not bool(status.get("coinSlotEnabled", true)) or bool(status.get("freePlay", false)):
		_proceed()
		return
	if int(status.get("credits", 0)) > 0:
		_proceed()
		return

	credits_label.text = ""
	hardware_label.text = "" if bool(status.get("hardwareConnected", false)) else "Coin acceptor not detected"

func _on_coin_inserted(status: Dictionary) -> void:
	var credits := int(status.get("credits", 0))
	credits_label.text = "CREDITS: %d" % credits
	if credits > 0:
		_proceed()

func _proceed() -> void:
	if proceeding:
		return
	proceeding = true
	ScreenManager.change_to_main_menu()

func _unhandled_input(event: InputEvent) -> void:
	if not konami_enabled or proceeding:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		_track_konami(event.keycode)

func _track_konami(keycode: int) -> void:
	if keycode == KONAMI_SEQUENCE[konami_progress]:
		konami_progress += 1
		if konami_progress >= KONAMI_SEQUENCE.size():
			konami_progress = 0
			Communicator.set_free_play(true)
	else:
		konami_progress = 1 if keycode == KONAMI_SEQUENCE[0] else 0
