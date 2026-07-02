extends Node

signal cover_ready(game_id: String, texture: Texture2D)

var _textures: Dictionary = {}
var _requested: Dictionary = {}

func _ready() -> void:
	Communicator.cover_received.connect(_on_cover_received)
	Communicator.cover_updated.connect(_on_cover_updated)

func get_texture(game_id: String) -> Texture2D:
	return _textures.get(game_id, null)

func request_cover(game_id: String) -> void:
	if game_id == "" or _textures.has(game_id) or _requested.has(game_id):
		return
	_requested[game_id] = true
	Communicator.get_cover(game_id)

func _on_cover_updated(game_id: String) -> void:
	if game_id == "":
		return
	_textures.erase(game_id)
	_requested.erase(game_id)
	request_cover(game_id)

func _on_cover_received(game_id: String, cover_data: String) -> void:
	_requested.erase(game_id)
	if cover_data == "":
		return

	var image := Image.new()
	var buffer := Marshalls.base64_to_raw(cover_data)
	var err := image.load_png_from_buffer(buffer)
	if err != OK:
		err = image.load_jpg_from_buffer(buffer)
	if err != OK:
		return

	var texture := ImageTexture.create_from_image(image)
	_textures[game_id] = texture
	cover_ready.emit(game_id, texture)
