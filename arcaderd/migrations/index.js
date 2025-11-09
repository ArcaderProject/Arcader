import * as migration0001 from "./0001-create-config.js";
import * as migration0002 from "./0002-create-roms.js";

export const migrations = [
    {id: "0001-create-config", module: migration0001},
    {id: "0002-create-roms", module: migration0002},
];