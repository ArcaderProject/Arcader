extends Control

const KONAMI_SEQUENCE := [
	KEY_UP, KEY_UP, KEY_DOWN, KEY_DOWN,
	KEY_LEFT, KEY_RIGHT, KEY_LEFT, KEY_RIGHT,
	KEY_B, KEY_A,
]

const SLOT_CENTER_X := 960.0
const COIN_SLIDE_DURATION := 1.8

@onready var coin_sprite: TextureRect = $CoinClip/Coin
@onready var insert_label: Label = $InsertLabel
@onready var info_label: Label = $InfoLabel
@onready var credits_label: Label = $CreditsLabel
@onready var hardware_label: Label = $HardwareLabel

var coin_start_x := 1210.0
var coin_end_x := SLOT_CENTER_X - 72.0
var coin_slide_t := 0.0

var konami_enabled := false
var konami_progress := 0
var proceeding := false
var blink_time := 0.0

func _ready() -> void:
	if Communicator.has_signal("coin_status"):
		Communicator.coin_status.connect(_on_coin_status)
	if Communicator.has_signal("coin_inserted"):
		Communicator.coin_inserted.connect(_on_coin_inserted)
	Communicator.get_coin_status()

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

	if not bool(status.get("coinSlotEnabled", true)) or bool(status.get("freePlay", false)) or _has_play(status):
		_proceed()
		return

	credits_label.text = ""
	hardware_label.text = "" if bool(status.get("hardwareConnected", false)) else "Coin acceptor not detected"

func _on_coin_inserted(status: Dictionary) -> void:
	credits_label.text = _play_text(status)
	if _has_play(status):
		_proceed()

func _has_play(status: Dictionary) -> bool:
	if bool(status.get("timeMode", false)):
		return int(status.get("remainingSeconds", 0)) > 0
	return int(status.get("credits", 0)) > 0

func _play_text(status: Dictionary) -> String:
	if bool(status.get("timeMode", false)):
		var s := int(status.get("remainingSeconds", 0))
		return "TIME: %02d:%02d" % [s / 60, s % 60]
	return "CREDITS: %d" % int(status.get("credits", 0))

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
