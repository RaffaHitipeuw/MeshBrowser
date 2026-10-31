#include "engine/engine_window_delegate.h"

#include "include/views/cef_box_layout.h"
#include "include/views/cef_fill_layout.h"
#include "include/views/cef_overlay_controller.h"

#include <algorithm>

namespace engine {

EngineWindowDelegate::EngineWindowDelegate(
    CefRefPtr<CefBrowserView> shell_view,
    CefRefPtr<CefBrowserView> content_view,
    CefRefPtr<CefBrowserView> overlay_view,
    cef_runtime_style_t runtime_style,
    CefRefPtr<EngineClient> client)
    : shell_view_(shell_view),
      content_view_(content_view),
      overlay_view_(overlay_view),
      runtime_style_(runtime_style),
      client_(client) {}

void EngineWindowDelegate::OnWindowCreated(CefRefPtr<CefWindow> window) {
  // Vertical BoxLayout on the window itself: shell strip on top, content
  // below. Never use FillLayout with two children — it stacks them fullscreen.
  CefBoxLayoutSettings settings;
  settings.horizontal = 0;
  settings.between_child_spacing = 0;
  settings.default_flex = 0;
  settings.cross_axis_alignment = CEF_AXIS_ALIGNMENT_STRETCH;
  CefRefPtr<CefBoxLayout> layout = window->SetToBoxLayout(settings);

  window->AddChildView(shell_view_);
  if (content_view_) {
    window->AddChildView(content_view_);
    content_view_->SetVisible(false);
  }

  if (layout) {
    // Start mode: shell soaks up all space; content is hidden.
    layout->SetFlexForView(shell_view_, 1);
    if (content_view_) {
      layout->SetFlexForView(content_view_, 1);
    }
  }

  // Dropdown overlay: floats above both browser views with its own z-order,
  // so menus never resize/push the content pane. Added last so it stacks
  // on top of all child views.
  if (overlay_view_) {
    CefRefPtr<CefOverlayController> overlay_controller =
        window->AddOverlayView(overlay_view_, CEF_DOCKING_MODE_CUSTOM,
                               /*can_activate=*/true);
    if (overlay_controller) {
      overlay_controller->SetVisible(false);
    }
    if (client_) {
      client_->SetOverlayController(overlay_controller);
    }
  }

  if (client_) {
    client_->OnEngineApplyWindowAppearance(window);
  }
  window->Show();

  if (client_) {
    client_->OnEngineApplyContentTheme();
    client_->LayoutContentBrowser();
  }
}

void EngineWindowDelegate::OnWindowDestroyed(CefRefPtr<CefWindow> window) {
  (void)window;
  if (client_) {
    client_->SetOverlayController(nullptr);
    client_->CancelAppMenu();
    client_->OnEngineDestroyProductOverlays();
  }
  shell_view_ = nullptr;
  content_view_ = nullptr;
  overlay_view_ = nullptr;
}

void EngineWindowDelegate::OnWindowBoundsChanged(CefRefPtr<CefWindow> window,
                                                  const CefRect& new_bounds) {
  (void)window;
  (void)new_bounds;
  if (client_) {
    // Anchors are stale after a resize; dismiss tip overlay + native menu.
    // Do NOT call LayoutContentBrowser / WasResized here — BoxLayout already
    // resizes the content pane. Extra WasResized mid-drag makes sites like
    // YouTube Shorts treat the viewport jump as a scroll and change videos.
    client_->OverlayHide();
    client_->CancelAppMenu();
    client_->OnEngineLayoutProductOverlays();
  }
}

bool EngineWindowDelegate::CanClose(CefRefPtr<CefWindow> window) {
  (void)window;
  if (client_) {
    client_->OnEngineWindowClosing();
  }
  CefRefPtr<CefBrowser> browser =
      shell_view_ ? shell_view_->GetBrowser() : nullptr;
  if (browser) {
    return browser->GetHost()->TryCloseBrowser();
  }
  return true;
}

CefSize EngineWindowDelegate::GetPreferredSize(CefRefPtr<CefView> view) {
  (void)view;
  return CefSize(1280, 800);
}

cef_runtime_style_t EngineWindowDelegate::GetWindowRuntimeStyle() {
  return runtime_style_;
}

bool EngineWindowDelegate::IsFrameless(CefRefPtr<CefWindow> window) {
  (void)window;
  return true;
}

bool EngineWindowDelegate::CanResize(CefRefPtr<CefWindow> window) {
  (void)window;
  return true;
}

bool EngineWindowDelegate::CanMaximize(CefRefPtr<CefWindow> window) {
  (void)window;
  return true;
}

bool EngineWindowDelegate::CanMinimize(CefRefPtr<CefWindow> window) {
  (void)window;
  return true;
}

EngineDevToolsWindowDelegate::EngineDevToolsWindowDelegate(
    CefRefPtr<CefBrowserView> view,
    cef_runtime_style_t runtime_style)
    : view_(view), runtime_style_(runtime_style) {}

void EngineDevToolsWindowDelegate::OnWindowCreated(
    CefRefPtr<CefWindow> window) {
  window->SetToFillLayout();
  if (view_) {
    window->AddChildView(view_);
  }
  window->SetTitle("DevTools");
  window->Show();
}

void EngineDevToolsWindowDelegate::OnWindowDestroyed(
    CefRefPtr<CefWindow> window) {
  (void)window;
  view_ = nullptr;
}

bool EngineDevToolsWindowDelegate::CanClose(CefRefPtr<CefWindow> window) {
  (void)window;
  if (view_) {
    if (auto browser = view_->GetBrowser()) {
      return browser->GetHost()->TryCloseBrowser();
    }
  }
  return true;
}

CefSize EngineDevToolsWindowDelegate::GetPreferredSize(CefRefPtr<CefView> view) {
  (void)view;
  return CefSize(1000, 760);
}

cef_runtime_style_t EngineDevToolsWindowDelegate::GetWindowRuntimeStyle() {
  // DevTools frontend is Chrome WebUI. An Alloy window cannot host it and
  // will take down the process when the inspector loads.
  (void)runtime_style_;
  return CEF_RUNTIME_STYLE_CHROME;
}

bool EngineDevToolsWindowDelegate::IsFrameless(CefRefPtr<CefWindow> window) {
  (void)window;
  return false;
}

bool EngineDevToolsWindowDelegate::CanResize(CefRefPtr<CefWindow> window) {
  (void)window;
  return true;
}

bool EngineDevToolsWindowDelegate::CanMaximize(CefRefPtr<CefWindow> window) {
  (void)window;
  return true;
}

bool EngineDevToolsWindowDelegate::CanMinimize(CefRefPtr<CefWindow> window) {
  (void)window;
  return true;
}

EngineBrowserViewDelegate::EngineBrowserViewDelegate(
    cef_runtime_style_t runtime_style,
    BrowserPane pane,
    CefRefPtr<EngineClient> client)
    : runtime_style_(runtime_style), pane_(pane), client_(client) {}

void EngineBrowserViewDelegate::OnBrowserCreated(
    CefRefPtr<CefBrowserView> browser_view,
    CefRefPtr<CefBrowser> browser) {
  (void)browser_view;
  if (client_) {
    client_->RegisterBrowserPane(browser, pane_);
  }
}

void EngineBrowserViewDelegate::OnBrowserDestroyed(
    CefRefPtr<CefBrowserView> browser_view,
    CefRefPtr<CefBrowser> browser) {
  (void)browser_view;
  if (!client_) {
    return;
  }
  client_->UnregisterBrowserPane(browser);
  if (pane_ == BrowserPane::DevTools) {
    if (client_->devtools_browser_view()) {
      if (auto shell = client_->shell_browser_view()) {
        if (auto window = shell->GetWindow()) {
          window->RemoveChildView(client_->devtools_browser_view());
        }
      }
      client_->SetDevToolsBrowserView(nullptr);
      client_->LayoutContentBrowser();
    }
  }
}

CefRefPtr<CefBrowserViewDelegate>
EngineBrowserViewDelegate::GetDelegateForPopupBrowserView(
    CefRefPtr<CefBrowserView> browser_view,
    const CefBrowserSettings& settings,
    CefRefPtr<CefClient> client,
    bool is_devtools) {
  (void)browser_view;
  (void)settings;
  (void)client;
  if (is_devtools) {
    return new EngineBrowserViewDelegate(CEF_RUNTIME_STYLE_CHROME,
                                         BrowserPane::DevTools, client_);
  }
  return this;
}

bool EngineBrowserViewDelegate::OnPopupBrowserViewCreated(
    CefRefPtr<CefBrowserView> browser_view,
    CefRefPtr<CefBrowserView> popup_browser_view,
    bool is_devtools) {
  (void)browser_view;
  if (!is_devtools) {
    if (popup_browser_view) {
      if (auto browser = popup_browser_view->GetBrowser()) {
        browser->GetHost()->CloseBrowser(true);
      }
    }
    return true;
  }
  if (client_ && popup_browser_view) {
    if (auto browser = popup_browser_view->GetBrowser()) {
      client_->RegisterDevToolsBrowser(browser);
    }
    if (client_->IsDevToolsDocked() && client_->shell_browser_view()) {
      if (auto window = client_->shell_browser_view()->GetWindow()) {
        client_->SetDevToolsBrowserView(popup_browser_view);
        window->AddChildView(popup_browser_view);
        client_->LayoutContentBrowser();
        return true;
      }
    }
  }
  CefWindow::CreateTopLevelWindow(
      new EngineDevToolsWindowDelegate(popup_browser_view, runtime_style_));
  return true;
}

cef_runtime_style_t EngineBrowserViewDelegate::GetBrowserRuntimeStyle() {
  return runtime_style_;
}

CefSize EngineBrowserViewDelegate::GetPreferredSize(CefRefPtr<CefView> view) {
  (void)view;
  if (pane_ == BrowserPane::DevTools) {
    return CefSize(1000, 760);
  }
  if (pane_ == BrowserPane::Overlay) {
    // Actual bounds are controlled via CefOverlayController.
    return CefSize(244, 280);
  }
  if (pane_ == BrowserPane::Shell) {
    if (client_ && client_->content_visible()) {
      // Browsing: shell is exactly the chrome strip (titlebar + topbar).
      // The height comes from the UI's measured chrome height; a floor above
      // it leaves a gap between the titlebar and the content pane.
      const int h = std::max(1, client_->chrome_height());
      return CefSize(1280, h);
    }
    // Start page: preferred height is nominal; flex=1 stretches to fill.
    return CefSize(1280, 800);
  }
  // Content: nominal preferred size; flex=1 takes the remaining space.
  return CefSize(1280, 600);
}

CefSize EngineBrowserViewDelegate::GetMinimumSize(CefRefPtr<CefView> view) {
  (void)view;
  if (pane_ == BrowserPane::Shell && client_ && client_->content_visible()) {
    const int h = std::max(1, client_->chrome_height());
    return CefSize(200, h);
  }
  return CefSize();
}

}  // namespace engine
