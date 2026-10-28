import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG 组件模块
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { SelectButtonModule } from 'primeng/selectbutton';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { CalendarModule } from 'primeng/calendar';
import { SliderModule } from 'primeng/slider';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TabViewModule } from 'primeng/tabview';
import { TabMenuModule } from 'primeng/tabmenu';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { MessagesModule } from 'primeng/messages';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { ChipsModule } from 'primeng/chips';
import { MultiSelectModule } from 'primeng/multiselect';

/**
 * PrimeNG 共享模块 — 集中导入/导出所有项目中使用的 PrimeNG 组件。
 * 所有业务模块只需导入 SharedModule 即可获得全部 PrimeNG 能力。
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    // PrimeNG 组件
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    InputNumberModule,
    DropdownModule,
    SelectButtonModule,
    RadioButtonModule,
    CheckboxModule,
    CalendarModule,
    SliderModule,
    CardModule,
    DialogModule,
    ConfirmDialogModule,
    TabViewModule,
    TabMenuModule,
    TagModule,
    BadgeModule,
    ProgressBarModule,
    ProgressSpinnerModule,
    ToastModule,
    MessagesModule,
    DividerModule,
    TooltipModule,
    AvatarModule,
    AvatarGroupModule,
    ChipsModule,
    MultiSelectModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    // PrimeNG 组件
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    InputNumberModule,
    DropdownModule,
    SelectButtonModule,
    RadioButtonModule,
    CheckboxModule,
    CalendarModule,
    SliderModule,
    CardModule,
    DialogModule,
    ConfirmDialogModule,
    TabViewModule,
    TabMenuModule,
    TagModule,
    BadgeModule,
    ProgressBarModule,
    ProgressSpinnerModule,
    ToastModule,
    MessagesModule,
    DividerModule,
    TooltipModule,
    AvatarModule,
    AvatarGroupModule,
    ChipsModule,
    MultiSelectModule
  ],
  providers: [
    ConfirmationService,
    MessageService
  ]
})
export class SharedModule { }
