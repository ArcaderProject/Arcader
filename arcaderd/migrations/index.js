import * as migration0001 from "./0001-create-config.js";
import * as migration0002 from "./0002-create-roms.js";
import * as migration0003 from "./0003-create-game-lists.js";
import * as migration0004 from "./0004-create-save-folders.js";

export const migrations = [
    {id: "0001-create-config", module: migration0001},
    {id: "0002-create-roms", module: migration0002},
    {id: "0003-create-game-lists", module: migration0003},
    {id: "0004-create-save-folders", module: migration0004},
];