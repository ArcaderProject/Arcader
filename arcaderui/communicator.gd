extends "res://api.gd"

signal games_received(games: Array)
signal games_error(error: String)
signal game_started(game_info: Dictionary)
signal game_start_error(error: String)
signal screen_updated(screen: String)
signal cover_received(game_id: String, cover_data: String)

var pending_requests := {}
var next_request_id := 0

func _ready() -> void:
	super._ready()

func get_games() -> void:
	var request_id = _generate_request_id()
	pending_requests[request_id] = "GET_GAMES"
	
	send_message({
		"type": "GET_GAMES",
		"requestId": request_id,
		"data": {}
	})

func start_game(game_uuid: String) -> void:
	var request_id = _generate_request_id()
	pending_requests[request_id] = "START_GAME"
	
	send_message({
		"type": "START_GAME",
		"requestId": request_id,
		"data": {
			"gameUuid": game_uuid
		}
	})

func get_cover(game_id: String) -> void:
	var request_id = _generate_request_id()
	pending_requests[request_id] = "GET_COVER"
	
	send_message({
		"type": "GET_COVER",
		"requestId": request_id,
		"data": {
			"gameId": game_id
		}
	})

func _generate_request_id() -> String:
	next_request_id += 1
	return "req_" + str(next_request_id)

func handle_message(msg: Dictionary) -> void:
	super.handle_message(msg)
	
	if not msg.has("type"):
		return
	
	if msg["type"] == "UPDATE_SCREEN":
		_handle_update_screen(msg)
		return
	
	if msg.has("requestId"):
		var request_id = msg["requestId"]
		
		match msg["type"]:
			"GET_GAMES_RESPONSE":
				_handle_games_response(msg)
				pending_requests.erase(request_id)
			"START_GAME_RESPONSE":
				_handle_game_start_response(msg)
				pending_requests.erase(request_id)
			"START_GAME_ERROR":
				_handle_game_start_error(msg)
				pending_requests.erase(request_id)
			"GET_COVER_RESPONSE":
				_handle_cover_response(msg)
				pending_requests.erase(request_id)

func _handle_games_response(msg: Dictionary) -> void:
	if msg.get("success", false):
		var data = msg.get("data", {})
		var games = data.get("games", [])
		emit_signal("games_received", games)
	else:
		var error = msg.get("error", "Unknown error")
		emit_signal("games_error", error)

func _handle_game_start_response(msg: Dictionary) -> void:
	var data = msg.get("data", {})
	if data.get("success", false):
		var game_info = data.get("game", {})
		emit_signal("game_started", game_info)
	else:
		emit_signal("game_start_error", "Failed to start game")

func _handle_game_start_error(msg: Dictionary) -> void:
	var error = msg.get("error", "Unknown error")
	emit_signal("game_start_error", error)

func _handle_update_screen(msg: Dictionary) -> void:
	var data = msg.get("data", {})
	var screen = data.get("screen", "")
	if screen:
		emit_signal("screen_updated", screen)

func _handle_cover_response(msg: Dictionary) -> void:
	if msg.get("success", false):
		var data = msg.get("data", {})
		var game_id = data.get("gameId", "")
		var cover_data = data.get("coverData", "")
		if game_id:
			emit_signal("cover_received", game_id, cover_data)
