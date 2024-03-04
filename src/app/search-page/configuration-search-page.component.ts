import { HostWindowService } from '../shared/host-window.service';
import { SidebarService } from '../shared/sidebar/sidebar.service';
import { SearchComponent } from '../shared/search/search.component';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { pushInOut } from '../shared/animations/push';
import { SearchConfigurationService } from '../core/shared/search/search-configuration.service';
import { RouteService } from '../core/services/route.service';
import { SearchService } from '../core/shared/search/search.service';
import { Router } from '@angular/router';
import { APP_CONFIG, AppConfig } from '../../config/app-config.interface';
import { TranslateModule } from '@ngx-translate/core';
import { SearchLabelsComponent } from '../shared/search/search-labels/search-labels.component';
import { ThemedSearchFormComponent } from '../shared/search-form/themed-search-form.component';
import { ThemedSearchSidebarComponent } from '../shared/search/search-sidebar/themed-search-sidebar.component';
import { ThemedSearchResultsComponent } from '../shared/search/search-results/themed-search-results.component';
import { ViewModeSwitchComponent } from '../shared/view-mode-switch/view-mode-switch.component';
import { PageWithSidebarComponent } from '../shared/sidebar/page-with-sidebar.component';
import { NgIf, NgTemplateOutlet, AsyncPipe } from '@angular/common';
import { SEARCH_CONFIG_SERVICE } from '../my-dspace-page/my-dspace-configuration.service';

/**
 * This component renders a search page using a configuration as input.
 */
@Component({
    selector: 'ds-configuration-search-page',
    styleUrls: ['../shared/search/search.component.scss'],
    templateUrl: '../shared/search/search.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [pushInOut],
    providers: [
        {
            provide: SEARCH_CONFIG_SERVICE,
            useClass: SearchConfigurationService
        }
    ],
    standalone: true,
    imports: [NgIf, NgTemplateOutlet, PageWithSidebarComponent, ViewModeSwitchComponent, ThemedSearchResultsComponent, ThemedSearchSidebarComponent, ThemedSearchFormComponent, SearchLabelsComponent, AsyncPipe, TranslateModule]
})

export class ConfigurationSearchPageComponent extends SearchComponent {
  constructor(protected service: SearchService,
              protected sidebarService: SidebarService,
              protected windowService: HostWindowService,
              @Inject(SEARCH_CONFIG_SERVICE) public searchConfigService: SearchConfigurationService,
              protected routeService: RouteService,
              protected router: Router,
              @Inject(APP_CONFIG) protected appConfig: AppConfig,
  ) {
    super(service, sidebarService, windowService, searchConfigService, routeService, router, appConfig);
  }
}
