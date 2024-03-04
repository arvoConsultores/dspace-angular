import { ChangeDetectionStrategy, Component, EventEmitter, Inject, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';

import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import uniqueId from 'lodash/uniqueId';

import { PaginatedList } from '../../core/data/paginated-list.model';
import { RemoteData } from '../../core/data/remote-data';
import { DSpaceObject } from '../../core/shared/dspace-object.model';
import { pushInOut } from '../animations/push';
import { HostWindowService } from '../host-window.service';
import { SidebarService } from '../sidebar/sidebar.service';
import { hasValue, hasValueOperator, isEmpty, isNotEmpty } from '../empty.util';
import { RouteService } from '../../core/services/route.service';
import { PaginatedSearchOptions } from './models/paginated-search-options.model';
import { SearchResult } from './models/search-result.model';
import { SearchConfigurationService } from '../../core/shared/search/search-configuration.service';
import { SearchService } from '../../core/shared/search/search.service';
import { currentPath } from '../utils/route.utils';
import { Context } from '../../core/shared/context.model';
import { SortOptions } from '../../core/cache/models/sort-options.model';
import { SearchConfig } from '../../core/shared/search/search-filters/search-config.model';
import { SearchConfigurationOption } from './search-switch-configuration/search-configuration-option.model';
import { getFirstCompletedRemoteData } from '../../core/shared/operators';
import { followLink } from '../utils/follow-link-config.model';
import { Item } from '../../core/shared/item.model';
import { SearchObjects } from './models/search-objects.model';
import { ViewMode } from '../../core/shared/view-mode.model';
import { SelectionConfig } from './search-results/search-results.component';
import { ListableObject } from '../object-collection/shared/listable-object.model';
import { CollectionElementLinkType } from '../object-collection/collection-element-link.type';
import { SubmissionObject } from '../../core/submission/models/submission-object.model';
import { SearchFilterConfig } from './models/search-filter-config.model';
import { WorkspaceItem } from '../../core/submission/models/workspaceitem.model';
import { ITEM_MODULE_PATH } from '../../item-page/item-page-routing-paths';
import { COLLECTION_MODULE_PATH } from '../../collection-page/collection-page-routing-paths';
import { COMMUNITY_MODULE_PATH } from '../../community-page/community-page-routing-paths';
import { TranslateModule } from '@ngx-translate/core';
import { SearchLabelsComponent } from './search-labels/search-labels.component';
import { ThemedSearchFormComponent } from '../search-form/themed-search-form.component';
import { ThemedSearchSidebarComponent } from './search-sidebar/themed-search-sidebar.component';
import { ThemedSearchResultsComponent } from './search-results/themed-search-results.component';
import { ViewModeSwitchComponent } from '../view-mode-switch/view-mode-switch.component';
import { PageWithSidebarComponent } from '../sidebar/page-with-sidebar.component';
import { NgIf, NgTemplateOutlet, AsyncPipe } from '@angular/common';
import { SEARCH_CONFIG_SERVICE } from '../../my-dspace-page/my-dspace-configuration.service';
import { AppConfig, APP_CONFIG } from '../../../config/app-config.interface';

@Component({
    selector: 'ds-search',
    styleUrls: ['./search.component.scss'],
    templateUrl: './search.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [pushInOut],
    standalone: true,
    imports: [NgIf, NgTemplateOutlet, PageWithSidebarComponent, ViewModeSwitchComponent, ThemedSearchResultsComponent, ThemedSearchSidebarComponent, ThemedSearchFormComponent, SearchLabelsComponent, AsyncPipe, TranslateModule]
})

/**
 * This component renders a sidebar, a search input bar and the search results.
 */
export class SearchComponent implements OnDestroy, OnInit {

  /**
   * The list of available configuration options
   */
  @Input() configurationList: SearchConfigurationOption[] = [];

  /**
   * The current context
   * If empty, 'search' is used
   */
  @Input() context: Context = Context.Search;

  /**
   * The configuration to use for the search options
   * If empty, 'default' is used
   */
  @Input() configuration;

  /**
   * The actual query for the fixed filter.
   * If empty, the query will be determined by the route parameter called 'filter'
   */
  @Input() fixedFilterQuery: string;

  /**
   * If this is true, the request will only be sent if there's
   * no valid cached version. Defaults to true
   */
  @Input() useCachedVersionIfAvailable = true;

  /**
   * True when the search component should show results on the current page
   */
  @Input() inPlaceSearch = true;

  /**
   * The link type of the listed search results
   */
  @Input() linkType: CollectionElementLinkType;

  /**
   * The pagination id used in the search
   */
  @Input() paginationId = 'spc';

  /**
   * Whether or not the search bar should be visible
   */
  @Input() searchEnabled = true;

  /**
   * The width of the sidebar (bootstrap columns)
   */
  @Input() sideBarWidth = 3;

  /**
   * The placeholder of the search form input
   */
  @Input() searchFormPlaceholder = 'search.search-form.placeholder';

  /**
   * A boolean representing if result entries are selectable
   */
  @Input() selectable = false;

  /**
   * The config option used for selection functionality
   */
  @Input() selectionConfig: SelectionConfig;

  /**
   * A boolean representing if show csv export button
   */
  @Input() showCsvExport = false;

  /**
   * A boolean representing if show search sidebar button
   */
  @Input() showSidebar = true;

  /**
   * Whether to show the thumbnail preview
   */
  @Input() showThumbnails;

  /**
   * Whether to show the view mode switch
   */
  @Input() showViewModes = true;

  /**
   * List of available view mode
   */
  @Input() useUniquePageId: boolean;

  /**
   * List of available view mode
   */
  @Input() viewModeList: ViewMode[];

  /**
   * Defines whether or not to show the scope selector
   */
  @Input() showScopeSelector = true;

  /**
   * Whether or not to track search statistics by sending updates to the rest api
   */
  @Input() trackStatistics = false;

  /**
   * The default value for the search query when none is already defined in the {@link SearchConfigurationService}
   */
  @Input() query: string;

  /**
   * The fallback scope when no scope is defined in the url, if this is also undefined no scope will be set
   */
  @Input() scope: string;

  /**
   * Hides the scope in the url, this can be useful when you hardcode the scope in another way
   */
  @Input() hideScopeInUrl: boolean;

  /**
   * The current configuration used during the search
   */
  currentConfiguration$: BehaviorSubject<string> = new BehaviorSubject<string>('');

  /**
   * The current context used during the search
   */
  currentContext$: BehaviorSubject<Context> = new BehaviorSubject<Context>(null);

  /**
   * The current sort options used
   */
  currentScope$: Observable<string>;

  /**
   * The current sort options used
   */
  currentSortOptions$: BehaviorSubject<SortOptions> = new BehaviorSubject<SortOptions>(null);

  /**
   * An observable containing configuration about which filters are shown and how they are shown
   */
  filtersRD$: BehaviorSubject<RemoteData<SearchFilterConfig[]>> = new BehaviorSubject<RemoteData<SearchFilterConfig[]>>(null);

  /**
   * Maintains the last search options, so it can be used in refresh
   */
  lastSearchOptions: PaginatedSearchOptions;

  /**
   * The current search results
   */
  resultsRD$: BehaviorSubject<RemoteData<PaginatedList<SearchResult<DSpaceObject>>>> = new BehaviorSubject(null);

  /**
   * The current paginated search options
   */
  searchOptions$: BehaviorSubject<PaginatedSearchOptions> = new BehaviorSubject<PaginatedSearchOptions>(null);

  /**
   * The available sort options list
   */
  sortOptionsList$: BehaviorSubject<SortOptions[]> = new BehaviorSubject<SortOptions[]>([]);

  /**
   * TRUE if the search option are initialized
   */
  initialized$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Observable for whether or not the sidebar is currently collapsed
   */
  isSidebarCollapsed$: Observable<boolean>;

  /**
   * Emits true if were on a small screen
   */
  isXsOrSm$: Observable<boolean>;

  /**
   * Emits when the search filters values may be stale, and so they must be refreshed.
   */
  refreshFilters: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Link to the search page
   */
  searchLink: string;

  /**
   * Regex to match UUIDs
   */
  uuidRegex = /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/g;

  /**
   * List of paths that are considered to be the start of a route to an object page (excluding "/", e.g. "items")
   * These are expected to end on an object UUID
   * If they match the route we're navigating to, an object property will be added to the search event sent
   */
  allowedObjectPaths: string[] = ['entities', ITEM_MODULE_PATH, COLLECTION_MODULE_PATH, COMMUNITY_MODULE_PATH];

  /**
   * Subscriptions to unsubscribe from
   */
  subs: Subscription[] = [];

  /**
   * Emits an event with the current search result entries
   */
  @Output() resultFound: EventEmitter<SearchObjects<DSpaceObject>> = new EventEmitter<SearchObjects<DSpaceObject>>();

  /**
   * Emits event when the user deselect result entry
   */
  @Output() deselectObject: EventEmitter<ListableObject> = new EventEmitter<ListableObject>();

  /**
   * Emits event when the user select result entry
   */
  @Output() selectObject: EventEmitter<ListableObject> = new EventEmitter<ListableObject>();

  constructor(protected service: SearchService,
              protected sidebarService: SidebarService,
              protected windowService: HostWindowService,
              @Inject(SEARCH_CONFIG_SERVICE) public searchConfigService: SearchConfigurationService,
              protected routeService: RouteService,
              protected router: Router,
              @Inject(APP_CONFIG) protected appConfig: AppConfig,
  ) {
    this.isXsOrSm$ = this.windowService.isXsOrSm();
  }

  /**
   * Listening to changes in the paginated search options
   * If something changes, update the search results
   *
   * Listen to changes in the scope
   * If something changes, update the list of scopes for the dropdown
   */
  ngOnInit(): void {
    if (this.useUniquePageId) {
      // Create an unique pagination id related to the instance of the SearchComponent
      this.paginationId = uniqueId(this.paginationId);
    }

    this.searchConfigService.setPaginationId(this.paginationId);

    if (hasValue(this.configuration)) {
      this.routeService.setParameter('configuration', this.configuration);
    }
    if (hasValue(this.fixedFilterQuery)) {
      this.routeService.setParameter('fixedFilterQuery', this.fixedFilterQuery);
    }

    this.currentScope$ = this.routeService.getQueryParameterValue('scope').pipe(
      map((routeValue: string) => hasValue(routeValue) ? routeValue : this.scope),
    );

    this.isSidebarCollapsed$ = this.isSidebarCollapsed();
    this.searchLink = this.getSearchLink();
    this.currentContext$.next(this.context);

    // Determinate PaginatedSearchOptions and listen to any update on it
    const configuration$: Observable<string> = this.searchConfigService
      .getCurrentConfiguration(this.configuration).pipe(distinctUntilChanged());
    const searchSortOptions$: Observable<SortOptions[]> = combineLatest([configuration$, this.currentScope$]).pipe(
      switchMap(([configuration, scope]: [string, string]) => this.searchConfigService.getConfigurationSearchConfig(configuration, scope)),
      map((searchConfig: SearchConfig) => this.searchConfigService.getConfigurationSortOptions(searchConfig)),
      distinctUntilChanged()
    );
    const sortOption$: Observable<SortOptions> = searchSortOptions$.pipe(
      switchMap((searchSortOptions: SortOptions[]) => {
        const defaultSort: SortOptions = searchSortOptions[0];
        return this.searchConfigService.getCurrentSort(this.paginationId, defaultSort);
      }),
      distinctUntilChanged()
    );
    const searchOptions$: Observable<PaginatedSearchOptions> = this.getSearchOptions().pipe(distinctUntilChanged());

    this.subs.push(combineLatest([configuration$, searchSortOptions$, searchOptions$, sortOption$, this.currentScope$]).pipe(
      filter(([configuration, searchSortOptions, searchOptions, sortOption, scope]: [string, SortOptions[], PaginatedSearchOptions, SortOptions, string]) => {
        // filter for search options related to instanced paginated id
        return searchOptions.pagination.id === this.paginationId;
      }),
      debounceTime(100)
    ).subscribe(([configuration, searchSortOptions, searchOptions, sortOption, scope]: [string, SortOptions[], PaginatedSearchOptions, SortOptions, string]) => {
      // Build the PaginatedSearchOptions object
      const combinedOptions = Object.assign({}, searchOptions,
        {
          configuration: searchOptions.configuration || configuration,
          sort: sortOption || searchOptions.sort
        });
      if (combinedOptions.query === '') {
        combinedOptions.query = this.query;
      }
      if (isEmpty(combinedOptions.scope)) {
        combinedOptions.scope = scope;
      }
      const newSearchOptions = new PaginatedSearchOptions(combinedOptions);
      // check if search options are changed
      // if so retrieve new related results otherwise skip it
      if (JSON.stringify(newSearchOptions) !== JSON.stringify(this.searchOptions$.value)) {
        // Initialize variables
        this.currentConfiguration$.next(configuration);
        this.currentSortOptions$.next(newSearchOptions.sort);
        this.sortOptionsList$.next(searchSortOptions);
        this.searchOptions$.next(newSearchOptions);
        this.initialized$.next(true);
        // retrieve results
        this.retrieveSearchResults(newSearchOptions);
        this.retrieveFilters(newSearchOptions);
      }
    }));

    this.subscribeToRoutingEvents();
  }

  /**
   * Change the current context
   * @param context
   */
  public changeContext(context: Context) {
    this.currentContext$.next(context);
  }

  /**
   * Set the sidebar to a collapsed state
   */
  public closeSidebar(): void {
    this.sidebarService.collapse();
  }

  /**
   * Reset result list on view mode change
   */
  public changeViewMode() {
    this.resultsRD$.next(null);
  }

  /**
   * Set the sidebar to an expanded state
   */
  public openSidebar(): void {
    this.sidebarService.expand();
  }

  /**
   * Emit event to refresh filter content
   * @param $event
   */
  public onContentChange($event: any) {
    this.retrieveFilters(this.lastSearchOptions);
    this.refreshFilters.next(true);
  }

  /**
   * Unsubscribe from the subscriptions
   */
  ngOnDestroy(): void {
    this.subs.filter((sub) => hasValue(sub)).forEach((sub) => sub.unsubscribe());
  }

  /**
   * Get the current paginated search options
   * @returns {Observable<PaginatedSearchOptions>}
   */
  protected getSearchOptions(): Observable<PaginatedSearchOptions> {
    return this.searchConfigService.paginatedSearchOptions;
  }

  /**
   * Retrieve search filters by the given search options
   * @param searchOptions
   * @private
   */
  private retrieveFilters(searchOptions: PaginatedSearchOptions) {
    this.filtersRD$.next(null);
    this.searchConfigService.getConfig(searchOptions.scope, searchOptions.configuration).pipe(
      getFirstCompletedRemoteData(),
    ).subscribe((filtersRD: RemoteData<SearchFilterConfig[]>) => {
      this.filtersRD$.next(filtersRD);
    });
  }

  /**
   * Retrieve search result by the given search options
   * @param searchOptions
   * @private
   */
  private retrieveSearchResults(searchOptions: PaginatedSearchOptions) {
    this.resultsRD$.next(null);
    this.lastSearchOptions = searchOptions;
    let followLinks = [
      followLink<Item>('thumbnail', { isOptional: true }),
      followLink<SubmissionObject>('item', { isOptional: true }, followLink<Item>('thumbnail', { isOptional: true })) as any,
    ];
    if (this.appConfig.item.showAccessStatuses) {
      followLinks.push(followLink<Item>('accessStatus', { isOptional: true }));
    }
    if (this.configuration === 'supervision') {
      followLinks.push(followLink<WorkspaceItem>('supervisionOrders', { isOptional: true }) as any);
    }
    this.service.search(
      searchOptions,
      undefined,
      this.useCachedVersionIfAvailable,
      true,
      ...followLinks
      ).pipe(getFirstCompletedRemoteData())
      .subscribe((results: RemoteData<SearchObjects<DSpaceObject>>) => {
        if (results.hasSucceeded) {
          if (this.trackStatistics) {
            this.service.trackSearch(searchOptions, results.payload);
          }
          if (results.payload?.page?.length > 0) {
            this.resultFound.emit(results.payload);
          }
        }
        this.resultsRD$.next(results);
      });
  }

  /**
   * Subscribe to routing events to detect when a user moves away from the search page
   * When the user is routing to an object page, it needs to send out a separate search event containing that object's UUID
   * This method should only be called once and is essentially what SearchTrackingComponent used to do (now removed)
   * @private
   */
  private subscribeToRoutingEvents(): void {
    if (this.trackStatistics) {
      this.subs.push(
        this.router.events.pipe(
          filter((event) => event instanceof NavigationStart),
          map((event: NavigationStart) => this.getDsoUUIDFromUrl(event.url)),
          hasValueOperator(),
        ).subscribe((uuid) => {
          if (this.resultsRD$.value.hasSucceeded) {
            this.service.trackSearch(this.searchOptions$.value, this.resultsRD$.value.payload as SearchObjects<DSpaceObject>, uuid);
          }
        }),
      );
    }
  }

  /**
   * Get the UUID from a DSO url
   * Return null if the url isn't an object page (allowedObjectPaths) or the UUID couldn't be found
   * @param url
   */
  private getDsoUUIDFromUrl(url: string): string {
    if (isNotEmpty(url)) {
      if (this.allowedObjectPaths.some((path) => url.startsWith(`/${path}`))) {
        const uuid = url.substring(url.lastIndexOf('/') + 1);
        if (uuid.match(this.uuidRegex)) {
          return uuid;
        }
      }
    }
    return null;
  }

  /**
   * Check if the sidebar is collapsed
   * @returns {Observable<boolean>} emits true if the sidebar is currently collapsed, false if it is expanded
   */
  private isSidebarCollapsed(): Observable<boolean> {
    return this.sidebarService.isCollapsed;
  }

  /**
   * @returns {string} The base path to the search page, or the current page when inPlaceSearch is true
   */
  private getSearchLink(): string {
    if (this.inPlaceSearch) {
      return currentPath(this.router);
    }
    return this.service.getSearchLink();
  }

}
