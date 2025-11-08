extends Node

@warning_ignore("unused_signal")
signal connection_lost
@warning_ignore("unused_signal")
signal connection_restored

var stream: StreamPeerUnix
var connected := false
var thread: Thread
var mutex: Mutex
var exit_thread := false
var reconnect_timer: Timer
var reconnect_attempts := 0
var reconnect_delay := 2.0
var last_ping_time := 0.0
var ping_timeout := 5.0
var ping_timer: Timer
var ping_interval := 3.0

func _ready() -> void:
	stream = StreamPeerUnix.new()
	mutex = Mutex.new()
	thread = Thread.new()
	
	reconnect_timer = Timer.new()
	reconnect_timer.wait_time = reconnect_delay
	reconnect_timer.one_shot = true
	reconnect_timer.timeout.connect(_attempt_reconnect)
	add_child(reconnect_timer)
	
	ping_timer = Timer.new()
	ping_timer.wait_time = ping_interval
	ping_timer.timeout.connect(_send_ping)
	add_child(ping_timer)

	connect_to_daemon()
	if connected:
		thread.start(_thread_read_loop)
	else:
		_start_reconnect_attempts()

func get_socket_path() -> String:
	var xdg_runtime = OS.get_environment("XDG_RUNTIME_DIR")
	return xdg_runtime + "/arcaderd.sock" if xdg_runtime != "" else ""

func connect_to_daemon() -> void:
	var result = stream.open(get_socket_path())
	if result == OK:
		_handle_connection_restored()
	else:
		_handle_connection_loss()

func disconnect_from_daemon() -> void:
	mutex.lock()
	exit_thread = true
	mutex.unlock()

	if stream.is_open():
		stream.close()

	if thread and thread.is_started():
		thread.wait_to_finish()

	mutex.lock()
	connected = false
	mutex.unlock()

func send_message(data: Dictionary) -> void:
	mutex.lock()
	var connection_state = connected
	mutex.unlock()

	if not connection_state or not stream.is_open():
		_handle_connection_loss()
		return

	var result = stream.put_data((JSON.stringify(data) + "\n").to_utf8_buffer())
	if result != OK:
		_handle_connection_loss()
		return
	
	last_ping_time = Time.get_ticks_msec() / 1000.0

func test_connection() -> bool:
	mutex.lock()
	var connection_state = connected
	mutex.unlock()

	if not connection_state or not stream.is_open():
		return false
	
	var available = stream.get_available_bytes()
	if available < 0:
		return false
	
	var current_time = Time.get_ticks_msec() / 1000.0
	if current_time - last_ping_time > ping_timeout and last_ping_time > 0:
		return false
	
	return true

func send_event(type: String, data: Dictionary) -> void:
	send_message({"type": type, "data": data})

func _handle_connection_loss() -> void:
	mutex.lock()
	var was_connected = connected
	connected = false
	mutex.unlock()
	
	if was_connected:
		ping_timer.stop()
		call_deferred("emit_signal", "connection_lost")
		_start_reconnect_attempts()

func _send_ping() -> void:
	send_message({"type": "HELLO"})

func _handle_connection_restored() -> void:
	mutex.lock()
	var was_disconnected = not connected
	connected = true
	mutex.unlock()
	
	if was_disconnected:
		call_deferred("emit_signal", "connection_restored")
		reconnect_attempts = 0
		last_ping_time = Time.get_ticks_msec() / 1000.0
		ping_timer.start()

func _start_reconnect_attempts() -> void:
	call_deferred("_start_timer")

func _start_timer() -> void:
	reconnect_timer.start()

func _attempt_reconnect() -> void:
	reconnect_attempts += 1
	
	var socket_path = get_socket_path()
	if socket_path == "":
		call_deferred("_start_timer")
		return
	
	if stream.is_open():
		stream.close()
	
	var result = stream.open(socket_path)
	if result == OK:
		_handle_connection_restored()
		if thread and not thread.is_started():
			exit_thread = false
			thread = Thread.new()
			thread.start(_thread_read_loop)
	else:
		call_deferred("_start_timer")

func _thread_read_loop(_userdata = null) -> void:
	while true:
		mutex.lock()
		var should_exit = exit_thread
		mutex.unlock()
		if should_exit:
			break

		if not stream.is_open():
			_handle_connection_loss()
			break
		
		if stream.get_available_bytes() > 0:
			read_messages()
		else:
			OS.delay_msec(10)

func read_messages() -> void:
	var available = stream.get_available_bytes()
	if available < 0:
		_handle_connection_loss()
		return
	elif available == 0:
		return

	var res = stream.get_data(available)
	if res[0] != OK:
		_handle_connection_loss()
		return
	
	last_ping_time = Time.get_ticks_msec() / 1000.0

	for line in res[1].get_string_from_utf8().strip_edges().split("\n"):
		if line.strip_edges() != "":
			parse_message(line)

func parse_message(msg: String) -> void:
	var json = JSON.new()
	if json.parse(msg) == OK:
		call_deferred("handle_message", json.get_data())

func handle_message(_msg: Dictionary) -> void:
	pass

func _exit_tree() -> void:
	disconnect_from_daemon()
