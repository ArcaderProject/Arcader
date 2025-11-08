extends Node

var health_thread: Thread
var health_mutex: Mutex
var should_exit_health_thread := false
var last_connection_state := false

func _ready() -> void:
	health_mutex = Mutex.new()
	health_thread = Thread.new()

	if Communicator.has_signal("connection_lost"):
		Communicator.connection_lost.connect(_on_connection_lost)
	if Communicator.has_signal("connection_restored"):
		Communicator.connection_restored.connect(_on_connection_restored)
	
	last_connection_state = _check_api_health()
	if not last_connection_state:
		call_deferred("_ensure_loading_scene")
	else:
		call_deferred("_on_connection_restored")
	
	health_thread.start(_health_check_loop)

func _health_check_loop(_userdata = null) -> void:
	while true:
		health_mutex.lock()
		var should_exit = should_exit_health_thread
		health_mutex.unlock()
		
		if should_exit:
			break
		
		var current_connection_state = _check_api_health()
		
		if current_connection_state != last_connection_state:
			if current_connection_state:
				call_deferred("_on_connection_restored")
			else:
				call_deferred("_on_connection_lost")
			last_connection_state = current_connection_state
		
		OS.delay_msec(1000)

func _check_api_health() -> bool:
	if not Communicator:
		return false
	
	Communicator.mutex.lock()
	var connection_status = Communicator.connected
	Communicator.mutex.unlock()
	
	if not connection_status or not Communicator.stream or not Communicator.stream.is_open():
		if not connection_status:
			Communicator.attempt_reconnect()
		return false
	
	if not Communicator.test_connection():
		Communicator._handle_connection_loss()
		return false
	
	return true

func _on_connection_lost() -> void:
	last_connection_state = false
	get_tree().change_scene_to_file("res://scenes/Loading.tscn")

func _on_connection_restored() -> void:
	last_connection_state = true
	get_tree().change_scene_to_file("res://scenes/MainMenu.tscn")

func _ensure_loading_scene() -> void:
	var current_scene = get_tree().current_scene
	if current_scene and current_scene.scene_file_path != "res://scenes/Loading.tscn":
		get_tree().change_scene_to_file("res://scenes/Loading.tscn")

func _exit_tree() -> void:
	health_mutex.lock()
	should_exit_health_thread = true
	health_mutex.unlock()
	
	if health_thread and health_thread.is_started():
		health_thread.wait_to_finish()
