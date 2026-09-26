import chunkCommon from "./chunks/common.glsl";
import chunkNoise from "./chunks/noise.glsl";
import chunkSky from "./chunks/sky.glsl";
import chunkMist from "./chunks/mist.glsl";

import skyVertBody from "./sky.vert.glsl";
import skyFragBody from "./sky.frag.glsl";
import worldVertBody from "./world.vert.glsl";
import groundFragBody from "./ground.frag.glsl";
import groundVertBody from "./ground.vert.glsl";
import stoneVertBody from "./stone.vert.glsl";
import stoneFragBody from "./stone.frag.glsl";
import uvVertBody from "./uv.vert.glsl";
import haloFragBody from "./halo.frag.glsl";
import cardVertBody from "./card.vert.glsl";
import cardFragBody from "./card.frag.glsl";
import postVertBody from "./post.vert.glsl";
import postFragBody from "./post.frag.glsl";
import ridgeVertBody from "./ridge.vert.glsl";
import ridgeFragBody from "./ridge.frag.glsl";
import photoVertBody from "./photo.vert.glsl";
import photoFragBody from "./photo.frag.glsl";

/**
 * Same as the prototype: PRE = COMMON + NOISE + SKY + MIST, plain concatenation since raw
 * .glsl imports don't resolve #include.
 */
const PRE = chunkCommon + chunkNoise + chunkSky + chunkMist;

export const VS_SKY = skyVertBody;
export const FS_SKY = PRE + skyFragBody;

export const VS_WORLD = worldVertBody;
export const FS_GROUND = PRE + groundFragBody;
export const VS_GROUND = chunkCommon + chunkNoise + groundVertBody;

export const VS_STONE = stoneVertBody;
export const FS_STONE = PRE + stoneFragBody;

export const VS_UV = uvVertBody;
export const FS_HALO = chunkCommon + haloFragBody;

export const VS_CARD = cardVertBody;
export const FS_CARD = PRE + cardFragBody;

export const VS_POST = postVertBody;
export const FS_POST = chunkCommon + chunkNoise + postFragBody;

export const VS_RIDGE = chunkNoise + ridgeVertBody;
export const FS_RIDGE = PRE + ridgeFragBody;

export const VS_PHOTO = photoVertBody;
export const FS_PHOTO = PRE + photoFragBody;
