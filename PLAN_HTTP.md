# HTTP Request Handling Functionality - Files by Feature

## 1. Core Routing System

[](laravel/src/Illuminate/Routing/Router.php)
[](laravel/src/Illuminate/Routing/Route.php)
[](laravel/src/Illuminate/Routing/RouteCollection.php)
[](laravel/src/Illuminate/Routing/AbstractRouteCollection.php)
[](laravel/src/Illuminate/Routing/CompiledRouteCollection.php)
[](laravel/src/Illuminate/Routing/RouteCollectionInterface.php)
[](laravel/src/Illuminate/Routing/RouteAction.php)
[](laravel/src/Illuminate/Routing/RouteGroup.php)
[](laravel/src/Illuminate/Routing/RouteRegistrar.php)
[](laravel/src/Illuminate/Routing/RouteFileRegistrar.php)
[](laravel/src/Illuminate/Routing/RoutingServiceProvider.php)
[](laravel/src/Illuminate/Routing/Pipeline.php)
[](laravel/src/Illuminate/Routing/SortedMiddleware.php)
[](laravel/src/Illuminate/Routing/MiddlewareNameResolver.php)

[](laravel/tests/Integration/Routing/SimpleRouteTest.php)
[](laravel/tests/Integration/Routing/FluentRoutingTest.php)
[](laravel/tests/Integration/Routing/CompiledRouteCollectionTest.php)
[](laravel/tests/Integration/Routing/RouteCachingTest.php)
[](laravel/tests/Integration/Routing/RoutingServiceProviderTest.php)
[](laravel/tests/Integration/Routing/SerializableClosureV1CacheRouteTest.php)
[](laravel/tests/Integration/Routing/stubs/serializable-closure-v1/routes-v7.php)

## 2. Route Matching

[](laravel/src/Illuminate/Routing/Matching/ValidatorInterface.php)
[](laravel/src/Illuminate/Routing/Matching/HostValidator.php)
[](laravel/src/Illuminate/Routing/Matching/MethodValidator.php)
[](laravel/src/Illuminate/Routing/Matching/SchemeValidator.php)
[](laravel/src/Illuminate/Routing/Matching/UriValidator.php)

## 3. Route Parameters & Model Binding

[](laravel/src/Illuminate/Routing/RouteParameterBinder.php)
[](laravel/src/Illuminate/Routing/RouteBinding.php)
[](laravel/src/Illuminate/Routing/RouteSignatureParameters.php)
[](laravel/src/Illuminate/Routing/ImplicitRouteBinding.php)
[](laravel/src/Illuminate/Routing/ResolvesRouteDependencies.php)
[](laravel/src/Illuminate/Routing/RouteDependencyResolverTrait.php)
[](laravel/src/Illuminate/Routing/CreatesRegularExpressionRouteConstraints.php)
[](laravel/src/Illuminate/Routing/Middleware/SubstituteBindings.php)

[](laravel/tests/Integration/Routing/ImplicitModelRouteBindingTest.php)
[](laravel/tests/Integration/Routing/ImplicitBackedEnumRouteBindingTest.php)
[](laravel/tests/Integration/Routing/AbilityBackedEnum.php)
[](laravel/tests/Integration/Routing/CategoryBackedEnum.php)

## 4. Route URI Handling

[](laravel/src/Illuminate/Routing/RouteUri.php)

## 5. Controllers

[](laravel/src/Illuminate/Routing/Controller.php)
[](laravel/src/Illuminate/Routing/ControllerDispatcher.php)
[](laravel/src/Illuminate/Routing/CallableDispatcher.php)
[](laravel/src/Illuminate/Routing/ControllerMiddlewareOptions.php)
[](laravel/src/Illuminate/Routing/FiltersControllerMiddleware.php)
[](laravel/src/Illuminate/Routing/Controllers/HasMiddleware.php)
[](laravel/src/Illuminate/Routing/Controllers/Middleware.php)
[](laravel/src/Illuminate/Routing/Contracts/CallableDispatcher.php)
[](laravel/src/Illuminate/Routing/Contracts/ControllerDispatcher.php)

[](laravel/tests/Integration/Routing/HasMiddlewareTest.php)

## 6. Resource Routing

[](laravel/src/Illuminate/Routing/ResourceRegistrar.php)
[](laravel/src/Illuminate/Routing/PendingResourceRegistration.php)
[](laravel/src/Illuminate/Routing/PendingSingletonResourceRegistration.php)

[](laravel/tests/Integration/Routing/RouteApiResourceTest.php)
[](laravel/tests/Integration/Routing/RouteSingletonTest.php)
[](laravel/tests/Integration/Routing/Fixtures/ApiResourceTaskController.php)
[](laravel/tests/Integration/Routing/Fixtures/ApiResourceTestController.php)
[](laravel/tests/Integration/Routing/Fixtures/CreatableSingletonTestController.php)
[](laravel/tests/Integration/Routing/Fixtures/NestedSingletonTestController.php)
[](laravel/tests/Integration/Routing/Fixtures/SingletonTestController.php)

## 7. Special Route Types

[](laravel/src/Illuminate/Routing/RedirectController.php)
[](laravel/src/Illuminate/Routing/ViewController.php)

[](laravel/tests/Integration/Routing/RouteRedirectTest.php)
[](laravel/tests/Integration/Routing/RouteViewTest.php)
[](laravel/tests/Integration/Routing/FallbackRouteTest.php)
[](laravel/tests/Integration/Routing/RouteCanBackedEnumTest.php)
[](laravel/tests/Integration/Routing/RouteNameEnum.php)
[](laravel/tests/Integration/Routing/Fixtures/redirect_routes.php)
[](laravel/tests/Integration/Routing/Fixtures/wildcard_catch_all_routes.php)
[](laravel/tests/Integration/Routing/Fixtures/view.blade.php)

## 8. Routing Events

[](laravel/src/Illuminate/Routing/Events/RouteMatched.php)
[](laravel/src/Illuminate/Routing/Events/Routing.php)
[](laravel/src/Illuminate/Routing/Events/PreparingResponse.php)
[](laravel/src/Illuminate/Routing/Events/ResponsePrepared.php)

## 9. Routing Exceptions

[](laravel/src/Illuminate/Routing/Exceptions/BackedEnumCaseNotFoundException.php)
[](laravel/src/Illuminate/Routing/Exceptions/InvalidSignatureException.php)
[](laravel/src/Illuminate/Routing/Exceptions/MissingRateLimiterException.php)
[](laravel/src/Illuminate/Routing/Exceptions/StreamedResponseException.php)
[](laravel/src/Illuminate/Routing/Exceptions/UrlGenerationException.php)

## 10. URL Generation

[](laravel/src/Illuminate/Routing/UrlGenerator.php)
[](laravel/src/Illuminate/Routing/RouteUrlGenerator.php)
[](laravel/src/Illuminate/Support/Uri.php)

[](laravel/tests/Integration/Routing/UrlSigningTest.php)
[](laravel/tests/Integration/Routing/PreviousUrlTest.php)

## 11. Redirects

[](laravel/src/Illuminate/Routing/Redirector.php)
[](laravel/src/Illuminate/Http/RedirectResponse.php)

[](laravel/tests/Integration/Routing/RouteRedirectTest.php)

## 12. Response Factory

[](laravel/src/Illuminate/Routing/ResponseFactory.php)

[](laravel/tests/Integration/Http/ResponseTest.php)

## 13. HTTP Request

[](laravel/src/Illuminate/Http/Request.php)
[](laravel/src/Illuminate/Http/Concerns/CanBePrecognitive.php)
[](laravel/src/Illuminate/Http/Concerns/InteractsWithContentTypes.php)
[](laravel/src/Illuminate/Http/Concerns/InteractsWithFlashData.php)
[](laravel/src/Illuminate/Http/Concerns/InteractsWithInput.php)

[](laravel/tests/Integration/Routing/PrecognitionTest.php)
[](laravel/tests/Integration/Http/RequestDurationThresholdTest.php)

## 14. HTTP Response

[](laravel/src/Illuminate/Http/Response.php)
[](laravel/src/Illuminate/Http/JsonResponse.php)
[](laravel/src/Illuminate/Http/ResponseTrait.php)
[](laravel/src/Illuminate/Http/StreamedEvent.php)

[](laravel/tests/Integration/Http/ResponseTest.php)
[](laravel/tests/Integration/Http/JsonResponseTest.php)
[](laravel/tests/Integration/Routing/ResponsableTest.php)

## 15. File Uploads & Handling

[](laravel/src/Illuminate/Http/File.php)
[](laravel/src/Illuminate/Http/FileHelpers.php)
[](laravel/src/Illuminate/Http/UploadedFile.php)
[](laravel/src/Illuminate/Http/Testing/File.php)
[](laravel/src/Illuminate/Http/Testing/FileFactory.php)
[](laravel/src/Illuminate/Http/Testing/MimeType.php)

## 16. HTTP Exceptions

[](laravel/src/Illuminate/Http/Exceptions/HttpResponseException.php)
[](laravel/src/Illuminate/Http/Exceptions/MalformedUrlException.php)
[](laravel/src/Illuminate/Http/Exceptions/PostTooLargeException.php)
[](laravel/src/Illuminate/Http/Exceptions/ThrottleRequestsException.php)

## 17. Rate Limiting Middleware

[](laravel/src/Illuminate/Routing/Middleware/ThrottleRequests.php)
[](laravel/src/Illuminate/Routing/Middleware/ThrottleRequestsWithRedis.php)

[](laravel/tests/Integration/Http/ThrottleRequestsTest.php)
[](laravel/tests/Integration/Http/ThrottleRequestsWithRedisTest.php)

## 18. Signed URL Middleware

[](laravel/src/Illuminate/Routing/Middleware/ValidateSignature.php)

[](laravel/tests/Integration/Routing/UrlSigningTest.php)

## 19. HTTP Middleware (General)

[](laravel/src/Illuminate/Http/Middleware/AddLinkHeadersForPreloadedAssets.php)
[](laravel/src/Illuminate/Http/Middleware/CheckResponseForModifications.php)
[](laravel/src/Illuminate/Http/Middleware/FrameGuard.php)
[](laravel/src/Illuminate/Http/Middleware/SetCacheHeaders.php)
[](laravel/src/Illuminate/Http/Middleware/TrustHosts.php)
[](laravel/src/Illuminate/Http/Middleware/TrustProxies.php)
[](laravel/src/Illuminate/Http/Middleware/ValidatePathEncoding.php)
[](laravel/src/Illuminate/Http/Middleware/ValidatePostSize.php)

## 20. HTTP Kernel

[](laravel/src/Illuminate/Foundation/Http/Kernel.php)
[](laravel/src/Illuminate/Foundation/Http/Events/RequestHandled.php)

## 21. Form Requests

[](laravel/src/Illuminate/Foundation/Http/FormRequest.php)

## 22. Foundation HTTP Middleware

[](laravel/src/Illuminate/Foundation/Http/Middleware/InvokeDeferredCallbacks.php)
[](laravel/src/Illuminate/Foundation/Http/Middleware/PreventRequestsDuringMaintenance.php)
[](laravel/src/Illuminate/Foundation/Http/Middleware/TransformsRequest.php)
[](laravel/src/Illuminate/Foundation/Http/Middleware/TrimStrings.php)
[](laravel/src/Illuminate/Foundation/Http/Middleware/ValidatePostSize.php)
[](laravel/src/Illuminate/Foundation/Http/Middleware/Concerns/ExcludesPaths.php)

[](laravel/tests/Integration/Routing/PrecognitionTest.php)

## 23. Foundation Utilities

[](laravel/src/Illuminate/Foundation/Http/HtmlDumper.php)
[](laravel/src/Illuminate/Foundation/Http/MaintenanceModeBypassCookie.php)

## 24. Cookies

[](laravel/src/Illuminate/Cookie/CookieJar.php)
[](laravel/src/Illuminate/Cookie/CookieServiceProvider.php)
[](laravel/src/Illuminate/Cookie/CookieValuePrefix.php)
[](laravel/src/Illuminate/Cookie/Middleware/AddQueuedCookiesToResponse.php)
[](laravel/src/Illuminate/Cookie/Middleware/EncryptCookies.php)

## 25. Session Middleware

[](laravel/src/Illuminate/Session/Middleware/StartSession.php)

## 26. View System Core

[](laravel/src/Illuminate/View/Factory.php)
[](laravel/src/Illuminate/View/View.php)
[](laravel/src/Illuminate/View/ViewServiceProvider.php)
[](laravel/src/Illuminate/View/FileViewFinder.php)
[](laravel/src/Illuminate/View/ViewFinderInterface.php)
[](laravel/src/Illuminate/View/ViewName.php)
[](laravel/src/Illuminate/View/ViewException.php)

[](laravel/tests/Integration/View/BladeTest.php)
[](laravel/tests/Integration/View/RenderableViewExceptionTest.php)

## 27. View Engines

[](laravel/src/Illuminate/View/Engines/Engine.php)
[](laravel/src/Illuminate/View/Engines/EngineResolver.php)
[](laravel/src/Illuminate/View/Engines/CompilerEngine.php)
[](laravel/src/Illuminate/View/Engines/FileEngine.php)
[](laravel/src/Illuminate/View/Engines/PhpEngine.php)

## 28. Blade Compiler

[](laravel/src/Illuminate/View/Compilers/CompilerInterface.php)
[](laravel/src/Illuminate/View/Compilers/Compiler.php)
[](laravel/src/Illuminate/View/Compilers/BladeCompiler.php)
[](laravel/src/Illuminate/View/Compilers/ComponentTagCompiler.php)

[](laravel/tests/Integration/View/BladeTest.php)

## 29. Blade Compiler Concerns

[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesAuthorizations.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesClasses.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesComments.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesComponents.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesConditionals.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesContexts.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesEchos.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesErrors.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesFragments.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesHelpers.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesIncludes.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesInjections.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesJs.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesJson.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesLayouts.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesLoops.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesRawPhp.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesSessions.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesStacks.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesStyles.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesTranslations.php)
[](laravel/src/Illuminate/View/Compilers/Concerns/CompilesUseStatements.php)

[](laravel/tests/Integration/View/BladeTest.php)

## 30. View Components

[](laravel/src/Illuminate/View/Component.php)
[](laravel/src/Illuminate/View/AnonymousComponent.php)
[](laravel/src/Illuminate/View/DynamicComponent.php)
[](laravel/src/Illuminate/View/ComponentAttributeBag.php)
[](laravel/src/Illuminate/View/ComponentSlot.php)
[](laravel/src/Illuminate/View/AppendableAttributeValue.php)
[](laravel/src/Illuminate/View/InvokableComponentVariable.php)

[](laravel/tests/Integration/View/BladeAnonymousComponentTest.php)
[](laravel/tests/Integration/View/anonymous-components-1/app.blade.php)
[](laravel/tests/Integration/View/anonymous-components-2/buttons/danger.blade.php)
[](laravel/tests/Integration/View/anonymous-components-2/panel.blade.php)
[](laravel/tests/Integration/View/anonymous-components-templates/page.blade.php)

## 31. View Concerns

[](laravel/src/Illuminate/View/Concerns/ManagesComponents.php)
[](laravel/src/Illuminate/View/Concerns/ManagesEvents.php)
[](laravel/src/Illuminate/View/Concerns/ManagesFragments.php)
[](laravel/src/Illuminate/View/Concerns/ManagesLayouts.php)
[](laravel/src/Illuminate/View/Concerns/ManagesLoops.php)
[](laravel/src/Illuminate/View/Concerns/ManagesStacks.php)
[](laravel/src/Illuminate/View/Concerns/ManagesTranslations.php)

[](laravel/tests/Integration/View/BladeTest.php)

## 32. View Middleware

[](laravel/src/Illuminate/View/Middleware/ShareErrorsFromSession.php)

## 33. View Test Templates

[](laravel/tests/Integration/View/templates/components/appendable-panel.blade.php)
[](laravel/tests/Integration/View/templates/components/base-input.blade.php)
[](laravel/tests/Integration/View/templates/components/child-input.blade.php)
[](laravel/tests/Integration/View/templates/components/hello-span.blade.php)
[](laravel/tests/Integration/View/templates/components/input-with-slot.blade.php)
[](laravel/tests/Integration/View/templates/components/link.blade.php)
[](laravel/tests/Integration/View/templates/components/menu-item.blade.php)
[](laravel/tests/Integration/View/templates/components/menu.blade.php)
[](laravel/tests/Integration/View/templates/components/panel.blade.php)
[](laravel/tests/Integration/View/templates/consume.blade.php)
[](laravel/tests/Integration/View/templates/hello.blade.php)
[](laravel/tests/Integration/View/templates/renderable-exception.blade.php)
[](laravel/tests/Integration/View/templates/uses-appendable-panel.blade.php)
[](laravel/tests/Integration/View/templates/uses-child-input.blade.php)
[](laravel/tests/Integration/View/templates/uses-link.blade.php)
[](laravel/tests/Integration/View/templates/uses-panel-dynamically.blade.php)
[](laravel/tests/Integration/View/templates/uses-panel.blade.php)
[](laravel/tests/Integration/View/templates/varied-dynamic-calls.blade.php)

## 34. Contracts

[](laravel/src/Illuminate/Contracts/Routing/BindingRegistrar.php)
[](laravel/src/Illuminate/Contracts/Routing/Registrar.php)
[](laravel/src/Illuminate/Contracts/Routing/ResponseFactory.php)
[](laravel/src/Illuminate/Contracts/Routing/UrlGenerator.php)
[](laravel/src/Illuminate/Contracts/Routing/UrlRoutable.php)
[](laravel/src/Illuminate/Contracts/Http/Kernel.php)
[](laravel/src/Illuminate/Contracts/View/Engine.php)
[](laravel/src/Illuminate/Contracts/View/Factory.php)
[](laravel/src/Illuminate/Contracts/View/View.php)
[](laravel/src/Illuminate/Contracts/View/ViewCompilationException.php)

## 35. Facades

[](laravel/src/Illuminate/Support/Facades/Route.php)
[](laravel/src/Illuminate/Support/Facades/View.php)
[](laravel/src/Illuminate/Support/Facades/URL.php)
[](laravel/src/Illuminate/Support/Facades/Response.php)
[](laravel/src/Illuminate/Support/Facades/Redirect.php)
