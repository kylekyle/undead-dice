# encoding: UTF-8

require 'roda'
require 'concode'
require 'seconds'
require 'concurrent'
require 'message_bus'
require 'dotenv/load'
require 'securerandom'

GAMES = Concurrent::Map.new
MessageBus.configure(backend: :memory)

class UndeadDice < Roda
  plugin :json
  plugin :public
  plugin :message_bus
  plugin :status_handler
  plugin :slash_path_empty
  plugin :render, engine: 'slim'
  plugin :sessions, secret: ENV['SESSION_SECRET']

  plugin :content_security_policy do |csp|
    csp.default_src :none
    csp.style_src :self
    csp.script_src :self
    csp.font_src :self
    csp.img_src :self
    csp.connect_src :self
    csp.form_action :self
    csp.base_uri :none
    csp.frame_ancestors :none
    csp.block_all_mixed_content
    csp.upgrade_insecure_requests
  end
  
  # we use this to validate user params 
  plugin :typecast_params
  alias check typecast_params
  
  use Rack::CommonLogger
  
  status_handler(404) do
    view :card, locals: {
      title: '¯\_(ツ)_/¯', 
      text: "Hm. Nothing here. That's weird. Oh well!"
    }
  end

  route do |r|
    r.public

    r.root do 
      view :home
    end

    r.on 'new' do 
      r.get do
        if session['admin'] 
          code = Concode::Generator.new.generate SecureRandom.hex
          GAMES.put_if_absent(code, Time.now)
          r.redirect code
        else
          view :new
        end
      end

      r.post do 
        if r.POST['password'] == ENV['PASSWORD']
          puts ENV
          session['admin'] = true 
        end

        r.redirect
      end
    end

    r.on GAMES.keys do |code|
      r.message_bus
      game = GAMES[code]

      # MB.publish("/#{course_id}/#{action}", user,
      #   user_ids: [user['id']], 
      #   max_backlog_age: 1.hour,
      #   group_ids: instructor ? ['everyone'] : ['instructors']
      # )

      r.is do
        r.get do 
          render :game
        end
        
        r.post do

        end
      end
    end
  end
end

run UndeadDice.freeze.app