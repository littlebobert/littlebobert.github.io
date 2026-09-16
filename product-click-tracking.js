(function () {
  const productClickEndpoint = 'https://portfolio-backend.justin-garcia.workers.dev/api/v1/product-click';

  function trackProductClick(link) {
    const body = JSON.stringify({
      product: link.dataset.product,
      action: link.dataset.productAction,
    });
    const payload = new Blob([body], { type: 'text/plain;charset=UTF-8' });
    if (navigator.sendBeacon?.(productClickEndpoint, payload)) {
      return;
    }
    fetch(productClickEndpoint, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
    }).catch(() => {});
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-product][data-product-action]');
    if (link) {
      trackProductClick(link);
    }
  });
}());
