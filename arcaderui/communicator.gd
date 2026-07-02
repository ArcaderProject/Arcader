extends "res://api.gd"

signal games_received(games: Array)
signal games_error(error: String)
signal games_changed()
signal game_started(game_info: Dictionary)
signal game_start_error(error: String)
signal screen_updated(screen: String)
signal cover_received(game_id: String, cover_data: String)
signal cover_updated(game_id: String)
signal coin_status(status: Dictionary)
signal coin_inserted(status: Dictionary)
signal timer_started(remaining_seconds: int)
signal timer_tick(remaining_seconds: int, warning: bool)
signal timer_stopped()
signal overlay_open(data: Dictionary)
signal overlay_nav(action: String)
signal overlay_close()
signal usb_inserted(info: Dictionary)
signal usb_removed()
signal usb_progress(data: Dictionary)
signal usb_status(data: Dictionary)
signal usb_scan(data: Dictionary)
signal usb_export_done(msg: Dictionary)
signal usb_import_done(msg: Dictionary)

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

func get_coin_status() -> void:
	var request_id = _generate_request_id()
	pending_requests[request_id] = "GET_COIN_STATUS"

	send_message({
		"type": "GET_COIN_STATUS",
		"requestId": request_id,
		"data": {}
	})

func set_free_play(enabled: bool) -> void:
	var request_id = _generate_request_id()
	pending_requests[request_id] = "SET_FREE_PLAY"

	send_message({
		"type": "SET_FREE_PLAY",
		"requestId": request_id,
		"data": {
			"enabled": enabled
		}
	})

func usb_get_status() -> void:
	var request_id = _generate_request_id()
	pending_requests[request_id] = "USB_STATUS"
	send_message({"type": "USB_STATUS", "requestId": request_id, "data": {}})

func usb_scan_stick() -> void:
	var request_id = _generate_request_id()
	pending_requests[request_id] = "USB_SCAN"
	send_message({"type": "USB_SCAN", "requestId": request_id, "data": {}})

func usb_export(categories: Array) -> void:
	var request_id = _generate_request_id()
	pending_requests[request_id] = "USB_EXPORT"
	send_message({"type": "USB_EXPORT", "requestId": request_id, "data": {"categories": categories}})

func usb_import(categories: Array) -> void:
	var request_id = _generate_request_id()
	pending_requests[request_id] = "USB_IMPORT"
	send_message({"type": "USB_IMPORT", "requestId": request_id, "data": {"categories": categories}})

func resume_game() -> void:
	send_message({"type": "RESUME_GAME", "data": {}})

func exit_game() -> void:
	send_message({"type": "EXIT_GAME", "data": {}})

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

	if msg["type"] == "GAMES_UPDATED":
		emit_signal("games_changed")
		return

	if msg["type"] == "COVER_UPDATED":
		emit_signal("cover_updated", String(msg.get("data", {}).get("gameId", "")))
		return

	if msg["type"] == "COIN_INSERTED":
		var data = msg.get("data", {})
		emit_signal("coin_inserted", data)
		emit_signal("coin_status", data)
		return

	if msg["type"] == "COIN_STATUS":
		emit_signal("coin_status", msg.get("data", {}))
		return

	if msg["type"] == "TIMER_START":
		emit_signal("timer_started", int(msg.get("data", {}).get("remainingSeconds", 0)))
		return

	if msg["type"] == "TIMER_TICK":
		var tdata = msg.get("data", {})
		emit_signal("timer_tick", int(tdata.get("remainingSeconds", 0)), bool(tdata.get("warning", false)))
		return

	if msg["type"] == "TIMER_STOP":
		emit_signal("timer_stopped")
		return

	if msg["type"] == "OVERLAY_OPEN":
		emit_signal("overlay_open", msg.get("data", {}))
		return

	if msg["type"] == "OVERLAY_NAV":
		emit_signal("overlay_nav", String(msg.get("data", {}).get("action", "")))
		return

	if msg["type"] == "OVERLAY_CLOSE":
		emit_signal("overlay_close")
		return

	if msg["type"] == "USB_INSERTED":
		emit_signal("usb_inserted", msg.get("data", {}))
		return

	if msg["type"] == "USB_REMOVED":
		emit_signal("usb_removed")
		return

	if msg["type"] == "USB_PROGRESS":
		emit_signal("usb_progress", msg.get("data", {}))
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
			"GET_COIN_STATUS_RESPONSE", "SET_FREE_PLAY_RESPONSE":
				if msg.get("success", false):
					emit_signal("coin_status", msg.get("data", {}))
				pending_requests.erase(request_id)
			"USB_STATUS_RESPONSE":
				emit_signal("usb_status", msg.get("data", {}))
				pending_requests.erase(request_id)
			"USB_SCAN_RESPONSE":
				emit_signal("usb_scan", msg.get("data", {}))
				pending_requests.erase(request_id)
			"USB_EXPORT_RESPONSE":
				emit_signal("usb_export_done", msg)
				pending_requests.erase(request_id)
			"USB_IMPORT_RESPONSE":
				emit_signal("usb_import_done", msg)
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
