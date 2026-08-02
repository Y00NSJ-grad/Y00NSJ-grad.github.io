# frozen_string_literal: true

module NoIndex
  META_TAG = '<meta name="robots" content="noindex, nofollow">'

  def self.inject(document)
    return unless document.output_ext == ".html"
    return if document.output.include?('name="robots"')

    document.output.sub!(
      /<head(\s[^>]*)?>/i,
      "\\0\n  #{META_TAG}"
    )
  end
end

Jekyll::Hooks.register :pages, :post_render do |page|
  NoIndex.inject(page)
end

Jekyll::Hooks.register :documents, :post_render do |document|
  NoIndex.inject(document)
end