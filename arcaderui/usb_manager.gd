extends Node

const USB_SCENE := preload("res://scenes/UsbTransfer.tscn")
const OVERLAY_LAYER := 128

var _player: AudioStreamPlayer
var _layer: CanvasLayer = null
var _active := false

func _ready() -> void:
	_player = AudioStreamPlayer.new()
	_player.stream = _make_beep()
	add_child(_player)

	Communicator.usb_inserted.connect(_on_inserted)
	Communicator.usb_removed.connect(_on_removed)
	Communicator.usb_status.connect(_on_status)
	Communicator.connection_restored.connect(_request_status)
	_request_status.call_deferred()

func _request_status() -> void:
	Communicator.usb_get_status()

func _on_status(data: Dictionary) -> void:
	if bool(data.get("inserted", false)):
		_on_inserted(data)

func _on_inserted(_info: Dictionary) -> void:
	if _active:
		return
	_active = true

	_player.play()

	_layer = CanvasLayer.new()
	_layer.layer = OVERLAY_LAYER
	_layer.add_child(USB_SCENE.instantiate())
	get_tree().root.add_child(_layer)

func _on_removed() -> void:
	if not _active:
		return
	_active = false

	if is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null

func _make_beep() -> AudioStreamWAV:
	var mix_rate := 22050
	var duration := 0.12
	var freq := 880.0
	var fade := 0.012
	var sample_count := int(mix_rate * duration)

	var data := PackedByteArray()
	data.resize(sample_count * 2)
	for i in range(sample_count):
		var t := float(i) / mix_rate
		var env := 1.0
		if t < fade:
			env = t / fade
		elif t > duration - fade:
			env = (duration - t) / fade
		var sample := sin(TAU * freq * t) * env * 0.5
		data.encode_s16(i * 2, int(clampf(sample, -1.0, 1.0) * 32767.0))

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = mix_rate
	wav.stereo = false
	wav.data = data
	return wav
