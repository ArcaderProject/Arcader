extends HBoxContainer

@onready var game_label: Label = $GameLabel

var game_data: Dictionary = {}

func set_game_data(data: Dictionary) -> void:
	game_data = data
	_update_display()

func _update_display() -> void:
	if game_label:
		var text = ""

		if game_data.has("console") and game_data["console"] != "":
			text += "[" + game_data["console"] + "] "
		
		if game_data.has("name"):
			text += game_data["name"]
		else:
			text += "Unknown Game"
		
		if game_data.has("extension"):
			text += " (." + game_data["extension"] + ")"
		
		game_label.text = text

func get_game_id() -> String:
	return game_data.get("id", "")

func get_game_name() -> String:
	return game_data.get("name", "")

func has_cover_art() -> bool:
	return game_data.get("cover_art", false)
