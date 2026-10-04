/** The platforms a definition can build for. */
export enum System {
  x86_64Linux = "x86_64-linux",
  aarch64Linux = "aarch64-linux",
  x86_64Darwin = "x86_64-darwin",
  aarch64Darwin = "aarch64-darwin",
}

/**
 * A software rights license
 */
export class License {
  #kind = "license";
  constructor(readonly id: string) {}
}

/** Common software licenses, Use `new License(name)` for any other. */
export const Licenses = {
  MIT: new License("mit"),
  ASL20: new License("asl20"),
  BSD2: new License("bsd2"),
  BSD3: new License("bsd3"),
  GPL2Only: new License("gpl2Only"),
  GPL2Plus: new License("gpl2Plus"),
  GPL3Only: new License("gpl3Only"),
  GPL3Plus: new License("gpl3Plus"),
  LGPL3Only: new License("lgpl3Only"),
  AGPL3Only: new License("agpl3Only"),
  MPL20: new License("mpl20"),
  ISC: new License("isc"),
  UNLICENSED: new License("unlicense"),
  UNFREE: new License("unfree"),
};