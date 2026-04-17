// ID 生成ユーティリティ。プレフィックスで種別を可視化する。
import { nanoid } from "nanoid";

const LEN = 14;

export const newDocumentId = () => `p_${nanoid(LEN)}`;
export const newBlockId = () => `b_${nanoid(LEN)}`;
export const newAttachmentId = () => `att_${nanoid(LEN)}`;
export const newFreeElementId = () => `f_${nanoid(LEN)}`;
export const newTemplateId = () => `t_${nanoid(LEN)}`;
