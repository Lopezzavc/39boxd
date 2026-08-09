export class Spring {
  value: number;
  target: number;
  velocity = 0;
  constructor(value: number, public stiffness = 300, public damping = 22) {
    this.value = value;
    this.target = value;
  }
  setTarget(target: number) {
    this.target = target;
  }
  update(dt: number) {
    const force = (this.target - this.value) * this.stiffness;
    const dampingForce = this.velocity * this.damping;
    this.velocity += (force - dampingForce) * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
  isSettled() {
    return Math.abs(this.target - this.value) < 0.01 && Math.abs(this.velocity) < 0.01;
  }
}