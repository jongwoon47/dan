export const DAN_V1_CAMERA_NAMES = [
  "Fujifilm X100VI",
  "Fujifilm X100V",
  "Ricoh GR III",
  "Ricoh GR IIIx",
  "Sony RX100 VII",
] as const;

export const DAN_V1_CAMERA_IDS = [
  "prod-fuji-x100vi",
  "prod-fuji-x100v",
  "prod-ricoh-gr3",
  "prod-ricoh-gr3x",
  "prod-sony-rx100m7",
] as const;

export const DAN_V1_CAMERA_NAME_SET = new Set<string>(DAN_V1_CAMERA_NAMES);
export const DAN_V1_CAMERA_ID_SET = new Set<string>(DAN_V1_CAMERA_IDS);
