/**
 * 走访颜色状态(对应 PRD §6.3 地图视图)
 * - green  已走访且关系良好
 * - yellow 待跟进
 * - red    风险/警示
 * - blue   已走访备注(中性)
 *
 * 具体业务语义在 PRD §6.3 待最终拍定,此处先占位。
 */
export enum VisitColor {
  Green = 'green',
  Yellow = 'yellow',
  Red = 'red',
  Blue = 'blue',
}
