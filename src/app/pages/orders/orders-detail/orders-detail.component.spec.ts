import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdersDetailComponent } from './orders-detail.component';

describe('OrdersDetailComponent', () => {
  let component: OrdersDetailComponent;
  let fixture: ComponentFixture<OrdersDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersDetailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
