extends Node

const SCENE_LOADING = "res://scenes/Loading.tscn"
const SCENE_MAIN_MENU = "res://scenes/MainMenu.tscn"
const SCENE_GAMES_LIST = "res://scenes/GamesList.tscn"

func _ready() -> void:
	if Communicator.has_signal("screen_updated"):
		Communicator.screen_updated.connect(_on_screen_updated)

func _on_screen_updated(screen: String) -> void:
	match screen:
		"LOADING":
			get_tree().change_scene_to_file(SCENE_LOADING)
		"SELECTION":
			get_tree().change_scene_to_file(SCENE_MAIN_MENU)

func change_to_loading() -> void:
	get_tree().change_scene_to_file(SCENE_LOADING)

func change_to_main_menu() -> void:
	get_tree().change_scene_to_file(SCENE_MAIN_MENU)

func change_to_games_list() -> void:
	get_tree().change_scene_to_file(SCENE_GAMES_LIST)
