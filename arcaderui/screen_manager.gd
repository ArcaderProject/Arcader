extends Node

const SCENE_LOADING = "res://scenes/Loading.tscn"
const SCENE_MAIN_MENU = "res://scenes/MainMenu.tscn"
const SCENE_GAMES_LIST = "res://scenes/GamesList.tscn"
const SCENE_SEARCH = "res://scenes/Search.tscn"
const SCENE_COIN = "res://scenes/CoinScreen.tscn"
const SCENE_USB_TRANSFER = "res://scenes/UsbTransfer.tscn"

func _ready() -> void:
	if Communicator.has_signal("screen_updated"):
		Communicator.screen_updated.connect(_on_screen_updated)

func _on_screen_updated(screen: String) -> void:
	match screen:
		"LOADING":
			get_tree().change_scene_to_file(SCENE_LOADING)
		"SELECTION":
			get_tree().change_scene_to_file(SCENE_MAIN_MENU)
		"COIN":
			get_tree().change_scene_to_file(SCENE_COIN)

func change_to_loading() -> void:
	get_tree().change_scene_to_file(SCENE_LOADING)

func change_to_main_menu() -> void:
	get_tree().change_scene_to_file(SCENE_MAIN_MENU)

func change_to_games_list() -> void:
	get_tree().change_scene_to_file(SCENE_GAMES_LIST)

func change_to_search() -> void:
	get_tree().change_scene_to_file(SCENE_SEARCH)

func change_to_coin_screen() -> void:
	get_tree().change_scene_to_file(SCENE_COIN)
