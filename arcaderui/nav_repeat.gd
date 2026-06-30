class_name NavRepeat
extends RefCounted

const ACTIONS := ["ui_left", "ui_right", "ui_up", "ui_down"]
const INITIAL_DELAY := 0.35
const START_INTERVAL := 0.20
const MIN_INTERVAL := 0.04
const RAMP := 1.5

var _action := ""
var _held := 0.0
var _accum := 0.0

func poll(delta: float) -> String:
	var current := ""
	for a in ACTIONS:
		if Input.is_action_pressed(a):
			current = a
			break
	if current == "":
		_action = ""
		return ""
	if current != _action:
		_action = current
		_held = 0.0
		_accum = 0.0
		return ""
	_held += delta
	if _held < INITIAL_DELAY:
		return ""
	_accum += delta
	var t := clampf((_held - INITIAL_DELAY) / RAMP, 0.0, 1.0)
	var interval := lerpf(START_INTERVAL, MIN_INTERVAL, t)
	if _accum >= interval:
		_accum -= interval
		return _action
	return ""
